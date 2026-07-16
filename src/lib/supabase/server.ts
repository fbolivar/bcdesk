import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSessionToken, getCurrentUser, type AppUser } from '@/lib/auth/session'

type GetUserResult = { data: { user: unknown }; error: unknown }

function mapUser(user: AppUser) {
  // Forma mínima compatible con lo que consumen las páginas (user.id, user.email).
  return {
    id: user.id,
    email: user.email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: { full_name: user.full_name, role: user.role, token_version: user.token_version },
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
  //
  // Se delega en getCurrentUser(), que ADEMÁS de verificar la firma del JWT valida
  // contra la BD `is_active` y `token_version`. Antes aquí solo se verificaba la
  // firma: desactivar a un usuario o revocarle la sesión no surtía efecto en las
  // guardas de página durante toda la vida del token (7 días). Eso importaba
  // sobre todo en las rutas que usan service_role y por tanto saltan la RLS
  // (p. ej. el respaldo completo), donde la RLS no servía de red de seguridad.
  //
  // Es perezoso: la consulta a BD solo ocurre si alguien llama a getUser().
  ;(supabase.auth as unknown as { getUser: () => Promise<GetUserResult> }).getUser = async () => {
    const appUser = token ? await getCurrentUser() : null
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
