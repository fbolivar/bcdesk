import { createBrowserClient } from '@supabase/ssr'
import { SESSION_COOKIE } from '@/lib/auth/constants'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

export function createClient() {
  // La sesión propia (JWT) vive en una cookie legible por JS; la inyectamos para
  // que las queries y Realtime del navegador pasen RLS con la identidad del usuario.
  const token = readCookie(SESSION_COOKIE)

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined
  )

  if (token) {
    client.realtime.setAuth(token)
  }

  return client
}
