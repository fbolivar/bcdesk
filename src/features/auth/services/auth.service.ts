'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { setSessionCookie, clearSessionCookie, getCurrentUser, type AppUser } from '@/lib/auth/session'
import { checkRateLimit, registerFailedAttempt, clearAttempts } from '@/lib/auth/rate-limit'
import { sendPasswordResetEmail } from '@/lib/email/auth-emails'
import type { Role } from '@/lib/supabase/types'
import { redirect } from 'next/navigation'
import { randomBytes } from 'crypto'

interface AuthUserRow {
  id: string
  email: string
  full_name: string
  role: Role
  organization_id: string | null
  password_hash: string | null
  is_active: boolean
}

export async function login(email: string, password: string) {
  const cleanEmail = email.trim()

  // Rate limiting: bloquea tras varios intentos fallidos.
  const limit = await checkRateLimit(cleanEmail)
  if (limit.blocked) {
    const mins = Math.ceil(limit.retryAfterSeconds / 60)
    return { error: `Demasiados intentos fallidos. Intenta de nuevo en ${mins} minuto${mins === 1 ? '' : 's'}.` }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('auth_get_user_by_email', {
    p_email: cleanEmail,
  })
  if (error) return { error: 'No se pudo iniciar sesión. Intenta de nuevo.' }

  const row = (Array.isArray(data) ? data[0] : data) as AuthUserRow | undefined
  if (!row) {
    await registerFailedAttempt(cleanEmail)
    return { error: 'Credenciales inválidas' }
  }
  if (!row.is_active) return { error: 'Tu cuenta está desactivada. Contacta al administrador.' }

  const ok = await verifyPassword(password, row.password_hash ?? '')
  if (!ok) {
    await registerFailedAttempt(cleanEmail)
    return { error: 'Credenciales inválidas' }
  }

  await clearAttempts(cleanEmail)

  await setSessionCookie({
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    organization_id: row.organization_id,
  })

  // Registrar último acceso (best-effort; ya autenticados vía la nueva cookie).
  try {
    const authed = await createClient()
    await authed.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', row.id)
  } catch {
    // no bloquea el login
  }

  redirect('/dashboard')
}

export async function logout() {
  await clearSessionCookie()
  redirect('/login')
}

export async function register(email: string, password: string, fullName: string) {
  const cleanEmail = email.trim().toLowerCase()
  // Rate limit anti creación masiva de cuentas.
  const limit = await checkRateLimit(`register:${cleanEmail}`)
  if (limit.blocked) return { error: 'Demasiados intentos. Inténtalo más tarde.' }
  await registerFailedAttempt(`register:${cleanEmail}`)

  const supabase = await createClient()
  const password_hash = await hashPassword(password)

  const { data, error } = await supabase.rpc('auth_register_user', {
    p_email: email.trim(),
    p_password_hash: password_hash,
    p_full_name: fullName.trim(),
  })

  if (error) {
    if (error.code === '23505' || /EMAIL_TAKEN|unique/i.test(error.message)) {
      return { error: 'Ese email ya está registrado' }
    }
    return { error: 'No se pudo crear la cuenta. Intenta de nuevo.' }
  }

  const newId = data as string
  const user: AppUser = {
    id: newId,
    email: email.trim().toLowerCase(),
    full_name: fullName.trim(),
    role: 'client',
    organization_id: null,
  }
  await setSessionCookie(user)

  redirect('/dashboard')
}

export async function registerWithInvite(token: string, password: string, fullName: string) {
  const supabase = await createClient()
  const password_hash = await hashPassword(password)

  const { data, error } = await supabase.rpc('auth_complete_invite', {
    p_token: token,
    p_password_hash: password_hash,
    p_full_name: fullName.trim(),
  })

  if (error) {
    if (/INVITE_INVALID/.test(error.message)) {
      return { error: 'La invitación no es válida o ya fue utilizada.' }
    }
    if (error.code === '23505' || /EMAIL_TAKEN|unique/i.test(error.message)) {
      return { error: 'Ese email ya tiene una cuenta. Inicia sesión.' }
    }
    return { error: 'No se pudo completar el registro. Intenta de nuevo.' }
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    id: string
    email: string
    role: Role
    organization_id: string | null
  }

  await setSessionCookie({
    id: row.id,
    email: row.email,
    full_name: fullName.trim(),
    role: row.role,
    organization_id: row.organization_id,
  })

  redirect('/dashboard')
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'No autenticado. Inicia sesión de nuevo.' }

  if (!newPassword || newPassword.length < 8) {
    return { error: 'La nueva contraseña debe tener al menos 8 caracteres.' }
  }

  // Verificar la contraseña actual.
  const supabase = await createClient()
  const { data } = await supabase.rpc('auth_get_user_by_email', { p_email: user.email })
  const row = (Array.isArray(data) ? data[0] : data) as { password_hash: string | null } | undefined
  const ok = await verifyPassword(currentPassword, row?.password_hash ?? '')
  if (!ok) return { error: 'La contraseña actual es incorrecta.' }

  // Guardar el nuevo hash.
  const password_hash = await hashPassword(newPassword)
  const admin = createServiceClient()
  const { error } = await admin.from('profiles').update({ password_hash }).eq('id', user.id)
  if (error) return { error: 'No se pudo actualizar la contraseña. Intenta de nuevo.' }

  return { success: true }
}

export async function requestPasswordReset(email: string) {
  const cleanEmail = email.trim().toLowerCase()

  // Rate limit anti email-bombing (mismo respaldo que login).
  const limit = await checkRateLimit(`reset:${cleanEmail}`)
  if (limit.blocked) return { success: true } // respuesta genérica; no revela nada
  await registerFailedAttempt(`reset:${cleanEmail}`)

  // Buscar usuario (sin revelar si existe).
  const supabase = await createClient()
  const { data } = await supabase.rpc('auth_get_user_by_email', { p_email: cleanEmail })
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; is_active: boolean } | undefined

  if (row && row.is_active) {
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hora
    const admin = createServiceClient()
    await admin.from('password_reset_tokens').insert({
      token,
      user_id: row.id,
      expires_at: expiresAt,
    })
    await sendPasswordResetEmail(cleanEmail, token)
  }

  // Respuesta genérica siempre (no revela existencia del email).
  return { success: true }
}

export async function resetPassword(token: string, newPassword: string) {
  if (!newPassword || newPassword.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  }

  const admin = createServiceClient()
  const { data: row } = await admin
    .from('password_reset_tokens')
    .select('token, user_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return { error: 'El enlace no es válido o ya expiró. Solicita uno nuevo.' }
  }

  const password_hash = await hashPassword(newPassword)
  const { error: updErr } = await admin.from('profiles').update({ password_hash }).eq('id', row.user_id)
  if (updErr) return { error: 'No se pudo restablecer la contraseña. Intenta de nuevo.' }

  await admin.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)

  return { success: true }
}

export async function getInvitationByToken(token: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('auth_get_invitation', { p_token: token })

  if (error) return null
  const row = (Array.isArray(data) ? data[0] : data) as
    | { email: string; role: Role; organization_id: string | null; org_name: string | null }
    | undefined
  if (!row) return null

  return {
    email: row.email,
    role: row.role,
    organization_id: row.organization_id,
    organizations: row.org_name ? { name: row.org_name } : undefined,
  }
}
