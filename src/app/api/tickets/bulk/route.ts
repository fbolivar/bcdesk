import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids, action, value } = await req.json() as {
    ids: string[]
    action: 'assign' | 'status' | 'priority' | 'close' | 'delete'
    value?: string
  }

  if (!ids?.length) return NextResponse.json({ error: 'No tickets selected' }, { status: 400 })

  switch (action) {
    case 'assign':
      await supabase.from('tickets').update({ assigned_to: value ?? null }).in('id', ids)
      break
    case 'status':
      await supabase.from('tickets').update({ status: value }).in('id', ids)
      break
    case 'priority':
      await supabase.from('tickets').update({ priority: value }).in('id', ids)
      break
    case 'close':
      await supabase.from('tickets').update({ status: 'resolved', resolved_at: new Date().toISOString() }).in('id', ids)
      break
    case 'delete':
      await supabase.from('tickets').update({ status: 'closed' }).in('id', ids)
      break
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, affected: ids.length })
}
