import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/constants'
import { verifyToken } from '@/lib/auth/jwt'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Validar la sesión propia (JWT en cookie) sin depender de GoTrue.
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const payload = token ? await verifyToken(token) : null
  const isAuthed = !!payload
  const role = (payload?.user_role as string) ?? null

  // Rutas de autenticación: si ya hay sesión, ir al dashboard.
  if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/signup')) {
    if (isAuthed) return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.next()
  }

  // Rutas públicas.
  if (pathname.startsWith('/invite')) return NextResponse.next()
  if (pathname.startsWith('/forgot-password')) return NextResponse.next()
  if (pathname.startsWith('/reset-password')) return NextResponse.next()
  if (pathname.startsWith('/status')) return NextResponse.next()
  if (pathname.startsWith('/api-docs')) return NextResponse.next()

  // A partir de aquí se requiere sesión.
  if (!isAuthed) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Control de acceso por rol.
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  if (pathname.startsWith('/agent') && !['admin', 'agent'].includes(role ?? '')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Redirección del dashboard genérico según rol.
  if (pathname === '/dashboard') {
    if (role === 'admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    if (role === 'agent') return NextResponse.redirect(new URL('/agent/dashboard', request.url))
    return NextResponse.redirect(new URL('/client/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|manifest.json|sw.js|icon-.*\\.png|.*\\.(?:png|jpg|jpeg|svg|ico|webp)).*)'],
}
