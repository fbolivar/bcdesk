import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { source_id, target_id } = await req.json()
  if (!source_id || !target_id || source_id === target_id) {
    return NextResponse.json({ error: 'Invalid ticket IDs' }, { status: 400 })
  }

  // Move comments from source to target
  await supabase.from('ticket_comments').update({ ticket_id: target_id }).eq('ticket_id', source_id)

  // Move time logs
  await supabase.from('time_logs').update({ ticket_id: target_id }).eq('ticket_id', source_id)

  // Add merge note to target
  const { data: src } = await supabase.from('tickets').select('title').eq('id', source_id).single()
  await supabase.from('ticket_comments').insert({
    ticket_id: target_id,
    author_id: user.id,
    body: `🔀 Ticket #${source_id.slice(0, 8)} **"${src?.title}"** fue fusionado en este ticket.`,
    is_internal: true,
  })

  // Mark source as merged
  await supabase.from('tickets').update({
    is_merged: true,
    merged_into_id: target_id,
    status: 'closed',
  }).eq('id', source_id)

  return NextResponse.json({ ok: true })
}
