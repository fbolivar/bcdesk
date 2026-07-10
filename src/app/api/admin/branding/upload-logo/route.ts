import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'])
const MAX = 2 * 1024 * 1024 // 2 MB

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Formato no permitido. Usa PNG, JPG, WEBP, GIF o SVG.' }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: 'El logo supera 2 MB.' }, { status: 400 })

  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `logo-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('branding').upload(path, file, { contentType: file.type, upsert: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('branding').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}
