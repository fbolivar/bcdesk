'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hashPassword } from '@/lib/auth/password'
import { setPasswordHash } from '@/lib/auth/credentials'
import { sendWelcomeEmail } from '@/lib/email/auth-emails'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { z } from 'zod'

/**
 * Gestión del equipo por parte de un "administrador de cliente".
 *
 * SEGURIDAD (crítico): es la primera vez que un cliente crea/gestiona usuarios.
 *  - Solo un usuario con role='client' y is_org_admin=true puede usar estas acciones.
 *  - TODO se acota a SU organización: el organization_id y el role NUNCA vienen del
 *    cliente; se fijan al de su propio perfil y a 'client'. Así un org-admin no puede
 *    crear staff ni tocar otra organización.
 */
async function requireOrgAdmin(): Promise<
  | { ok: true; orgId: string; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }
  const { data: me } = await supabase
    .from('profiles').select('role, organization_id, is_org_admin').eq('id', user.id).single()
  if (!me || me.role !== 'client' || !me.is_org_admin || !me.organization_id) {
    return { ok: false, error: 'No tienes permiso para gestionar el equipo.' }
  }
  return { ok: true, orgId: me.organization_id as string, userId: user.id }
}

const inviteSchema = z.object({
  full_name: z.string().min(2, 'Escribe el nombre completo.'),
  email: z.string().email('Correo inválido.'),
})

/** Invita a un miembro al equipo de la organización del org-admin. Crea un usuario
 *  CLIENTE en SU organización, con contraseña temporal, y le envía la bienvenida. */
export async function inviteOrgMember(input: { full_name: string; email: string }): Promise<
  { error: string } | { ok: true; tempPassword: string; email: string }
> {
  const ctx = await requireOrgAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const email = parsed.data.email.trim().toLowerCase()
  const fullName = parsed.data.full_name.trim()

  const admin = createServiceClient()

  const { data: clash } = await admin.from('profiles').select('id').ilike('email', email).maybeSingle()
  if (clash) return { error: 'Ese correo ya está registrado en la plataforma.' }

  // role y organization_id FIJOS (nunca del cliente): cliente + su propia org.
  const { data: created, error } = await admin.from('profiles').insert({
    email,
    full_name: fullName,
    role: 'client',
    organization_id: ctx.orgId,
    is_active: true,
    is_org_admin: false,
  }).select('id').single()
  if (error || !created) return { error: 'No se pudo crear el usuario. Intenta de nuevo.' }

  const tempPassword = randomBytes(9).toString('base64url')
  const { error: credErr } = await setPasswordHash(created.id, await hashPassword(tempPassword))
  if (credErr) {
    await admin.from('profiles').delete().eq('id', created.id)
    return { error: 'No se pudo crear el usuario. Intenta de nuevo.' }
  }

  // Correo de bienvenida (no bloquea el alta si falla el envío).
  await sendWelcomeEmail({ to: email, name: fullName }).catch(() => {})

  revalidatePath('/client/team')
  return { ok: true, tempPassword, email }
}

/** Activa o desactiva a un miembro de la MISMA organización (solo clientes; nunca
 *  a sí mismo). */
export async function toggleOrgMember(memberId: string, active: boolean): Promise<{ error?: string }> {
  const ctx = await requireOrgAdmin()
  if (!ctx.ok) return { error: ctx.error }
  if (memberId === ctx.userId) return { error: 'No puedes desactivar tu propia cuenta.' }

  const admin = createServiceClient()
  // El objetivo debe ser un CLIENTE de la MISMA organización.
  const { data: target } = await admin
    .from('profiles').select('id, role, organization_id').eq('id', memberId).maybeSingle()
  if (!target || target.role !== 'client' || target.organization_id !== ctx.orgId) {
    return { error: 'Ese usuario no pertenece a tu equipo.' }
  }

  const { error } = await admin.from('profiles')
    .update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', memberId)
  if (error) return { error: 'No se pudo actualizar el usuario.' }

  revalidatePath('/client/team')
  return {}
}
