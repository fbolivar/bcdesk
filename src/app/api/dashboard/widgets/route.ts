import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase.from('dashboard_widgets').insert({
    user_id: user.id,
    widget_type: body.widget_type,
    title: body.title,
    config: body.config ?? {},
    position_x: body.position_x ?? 0,
    position_y: body.position_y ?? 0,
    width: body.width ?? 1,
    height: body.height ?? 1,
  }).select().single()

  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json(data)
}
