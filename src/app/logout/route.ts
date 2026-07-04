import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/constants'

/**
 * Cierre de sesión por GET. Limpia la cookie de sesión y envía a /login.
 * Sirve como destino de redirección cuando un token es válido pero la
 * sesión ya no lo es (p. ej. el perfil fue eliminado), rompiendo el
 * bucle página→/login/dashboard.
 */
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', request.url))
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
