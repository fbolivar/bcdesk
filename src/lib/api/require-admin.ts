import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Guard para route handlers admin. getUser() ya valida is_active y
 * token_version contra la BD, así que una sesión revocada no pasa.
 * Devuelve { user } si es admin, o { error: NextResponse } listo para retornar.
 */
export async function requireAdminApi(): Promise<
  | { user: { id: string; email: string }; error?: undefined }
  | { user?: undefined; error: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return { error: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  return { user: { id: user.id, email: (user as { email?: string }).email ?? '' } }
}
