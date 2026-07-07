import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface Params { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('dashboard_widgets').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // Whitelist de campos editables (evita mass-assignment de user_id u otras columnas).
  const allowed = ['widget_type', 'title', 'config', 'position_x', 'position_y', 'width', 'height'] as const
  const patch: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) patch[k] = body[k]

  const { data, error } = await supabase.from('dashboard_widgets')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select().single()

  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json(data)
}
