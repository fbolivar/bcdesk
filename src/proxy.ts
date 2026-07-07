import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, REALTIME_COOKIE, REALTIME_TOKEN_MAX_AGE } from '@/lib/auth/constants'
import { verifyToken, signRealtimeToken } from '@/lib/auth/jwt'

const isDev = process.env.NODE_ENV !== 'production'

/** Construye la CSP para la petición. En dev se relaja para no romper HMR/Turbopack. */
function buildCsp(nonce: string, isWidget: boolean): string {
  const rawSupa = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  // Solo incluir orígenes https válidos (ignora placeholders de entornos sin configurar).
  const supa = rawSupa.startsWith('https://') ? rawSupa : ''
  const supaWss = supa ? supa.replace('https://', 'wss://') : ''

  // En prod: nonce + strict-dynamic (defensa real contra XSS de scripts).
  // En dev: unsafe-inline/eval para que Turbopack y el HMR funcionen.
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    // React usa inline styles (atributo style=), que el nonce no cubre → unsafe-inline.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supa} ${supaWss}`.trim(),
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    // El widget de chat se embebe en sitios de clientes; el resto no se enmarca.
    isWidget ? `frame-ancestors *` : `frame-ancestors 'none'`,
    `frame-src 'self'`,
  ]
  if (!isDev) directives.push('upgrade-insecure-requests')
  return directives.join('; ')
}

/** Respuesta passthrough con el nonce propagado al request, CSP y (si hay) refresco del token RT. */
function pass(request: NextRequest, nonce: string, csp: string, rtToken: string | null): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('Content-Security-Policy', csp)
  if (rtToken) {
    res.cookies.set(REALTIME_COOKIE, rtToken, {
      httpOnly: false,
      secure: !isDev,
      sameSite: 'lax',
      path: '/',
      maxAge: REALTIME_TOKEN_MAX_AGE,
    })
  }
  return res
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const nonce = crypto.randomUUID().replace(/-/g, '')
  const csp = buildCsp(nonce, pathname.startsWith('/widget'))

  // Validar la sesión propia (JWT en cookie) sin depender de GoTrue.
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const payload = token ? await verifyToken(token) : null
  const isAuthed = !!payload
  const role = (payload?.user_role as string) ?? null

  // Rotar el token de Realtime (corta vida) en cada navegación autenticada.
  const rtToken = payload ? await signRealtimeToken(payload) : null
  const next = () => pass(request, nonce, csp, rtToken)

  // Rutas de autenticación: si ya hay sesión, ir al dashboard.
  if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/signup')) {
    if (isAuthed) return NextResponse.redirect(new URL('/dashboard', request.url))
    return next()
  }

  // Rutas públicas.
  if (pathname.startsWith('/logout')) return next()
  if (pathname.startsWith('/remote/')) return next()
  if (pathname.startsWith('/invite')) return next()
  if (pathname.startsWith('/forgot-password')) return next()
  if (pathname.startsWith('/reset-password')) return next()
  if (pathname.startsWith('/status')) return next()
  if (pathname.startsWith('/api-docs')) return next()
  if (pathname.startsWith('/widget')) return next()

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

  return next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|manifest.json|sw.js|offline|icon-.*\\.png|.*\\.(?:png|jpg|jpeg|svg|ico|webp)).*)'],
}
