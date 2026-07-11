import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { restoreBackup } from '@/features/admin/services/backup'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el archivo .fbb' }, { status: 400 })
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'El respaldo supera 50 MB' }, { status: 400 })

  const text = await file.text()
  const result = await restoreBackup(text)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const total = Object.values(result.restored ?? {}).reduce((s, n) => s + n, 0)
  return NextResponse.json({ ok: true, total, restored: result.restored })
}
