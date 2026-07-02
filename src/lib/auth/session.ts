import { cookies } from 'next/headers'
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/constants'
import { signSession, verifyToken, userFromPayload, type AppUser } from '@/lib/auth/jwt'

/**
 * Helpers de sesión que tocan cookies (server-only).
 * La lógica pura de JWT vive en `@/lib/auth/jwt` para poder usarse en el middleware.
 */

export { SESSION_COOKIE, SESSION_MAX_AGE, verifyToken, userFromPayload, signSession }
export type { AppUser }

export function sessionCookieOptions() {
  return {
    httpOnly: false, // el cliente de navegador necesita leerlo para Realtime + queries con RLS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  }
}

export async function setSessionCookie(user: AppUser): Promise<void> {
  const token = await signSession(user)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, sessionCookieOptions())
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value ?? null
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const token = await getSessionToken()
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null
  return userFromPayload(payload)
}
