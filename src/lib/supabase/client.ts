import { createBrowserClient } from '@supabase/ssr'
import { REALTIME_COOKIE } from '@/lib/auth/constants'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

export function createClient() {
  // La sesión larga es httpOnly (inaccesible a JS/XSS). Para queries + Realtime del
  // navegador usamos un token de corta vida (bcdesk_rt) que el middleware rota.
  const token = readCookie(REALTIME_COOKIE)

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
