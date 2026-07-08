import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile, tickets, comments, timeLogs] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('tickets').select('*').eq('created_by', user.id),
    supabase.from('ticket_comments').select('*').eq('author_id', user.id),
    supabase.from('time_logs').select('*').eq('agent_id', user.id),
  ])

  const exportData = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email, ...profile.data },
    tickets: tickets.data ?? [],
    comments: comments.data ?? [],
    time_logs: timeLogs.data ?? [],
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="gdpr-export-${user.id}.json"`,
    },
  })
}
