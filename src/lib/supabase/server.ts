import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSessionToken, verifyToken, userFromPayload, type AppUser } from '@/lib/auth/session'

type GetUserResult = { data: { user: unknown }; error: unknown }

function mapUser(user: AppUser) {
  // Forma mínima compatible con lo que consumen las páginas (user.id, user.email).
  return {
    id: user.id,
    email: user.email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: { full_name: user.full_name, role: user.role },
    created_at: '',
  }
}

export async function createClient() {
  const cookieStore = await cookies()
  const token = await getSessionToken()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Inyecta nuestro JWT: PostgREST lo valida y auth.uid() resuelve → RLS intacto.
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore en Server Components
          }
        },
      },
    }
  )

  // Autenticación propia: reemplazamos auth.getUser() de GoTrue por nuestra sesión.
  // Así las ~120 páginas que llaman `supabase.auth.getUser()` siguen funcionando sin cambios.
  const payload = token ? await verifyToken(token) : null
  const appUser = payload ? userFromPayload(payload) : null

  ;(supabase.auth as unknown as { getUser: () => Promise<GetUserResult> }).getUser = async () => {
    if (!appUser) {
      return {
        data: { user: null },
        error: { name: 'AuthSessionMissingError', message: 'Auth session missing!', status: 400 },
      }
    }
    return { data: { user: mapUser(appUser) }, error: null }
  }

  return supabase
}
