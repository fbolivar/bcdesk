import { cookies } from 'next/headers'
import { SESSION_COOKIE, SESSION_MAX_AGE, REALTIME_COOKIE, REALTIME_TOKEN_MAX_AGE } from '@/lib/auth/constants'
import { signSession, signRealtimeToken, verifyToken, userFromPayload, type AppUser } from '@/lib/auth/jwt'

/**
 * Helpers de sesión que tocan cookies (server-only).
 * La lógica pura de JWT vive en `@/lib/auth/jwt` para poder usarse en el middleware.
 */

export { SESSION_COOKIE, SESSION_MAX_AGE, verifyToken, userFromPayload, signSession }
export type { AppUser }

/** Sesión larga: httpOnly (inaccesible a JS/XSS). Fuente de verdad. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  }
}

/** Token de Realtime: legible por JS, corta vida, se rota en cada navegación (middleware). */
export function realtimeCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: REALTIME_TOKEN_MAX_AGE,
  }
}

export async function setSessionCookie(user: AppUser): Promise<void> {
  const token = await signSession(user)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, sessionCookieOptions())
  // Emitir también el token de corta vida para el navegador.
  const payload = await verifyToken(token)
  if (payload) {
    store.set(REALTIME_COOKIE, await signRealtimeToken(payload), realtimeCookieOptions())
  }
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  store.delete(REALTIME_COOKIE)
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value ?? null
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const token = await getSessionToken()
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload?.sub) return null

  // Validar contra la BD: revocación de sesión (token_version) y estado (is_active).
  // Rol/org se toman de la BD (autoritativo) → cambios se reflejan sin re-login.
  const { createServiceClient } = await import('@/lib/supabase/service')
  const admin = createServiceClient()
  const { data: prof, error } = await admin
    .from('profiles')
    .select('email, full_name, role, organization_id, is_active, token_version')
    .eq('id', payload.sub as string)
    .maybeSingle()

  // Ante fallo transitorio de BD, no cerrar sesión (fallback a la identidad del JWT).
  if (error) return userFromPayload(payload)
  if (!prof || !prof.is_active) return null
  if ((payload.tv as number ?? 0) !== (prof.token_version ?? 0)) return null

  return {
    id: payload.sub as string,
    email: prof.email,
    full_name: prof.full_name,
    role: prof.role,
    organization_id: prof.organization_id,
    token_version: prof.token_version,
  }
}
