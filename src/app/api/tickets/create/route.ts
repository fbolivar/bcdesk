import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data: ticket, error } = await supabase.from('tickets').insert({
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    category: (formData.get('category') as string) || 'support',
    priority: (formData.get('priority') as string) || 'medium',
    status: 'open',
    created_by: user.id,
    organization_id: profile?.organization_id ?? null,
    source_channel: 'web',
  }).select('id').single()

  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ id: ticket.id })
}
