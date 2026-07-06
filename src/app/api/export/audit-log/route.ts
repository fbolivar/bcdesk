import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('created_at, actor_email, action, resource_type, resource_id, ip_address')
    .order('created_at', { ascending: false })
    .limit(10000)

  const rows = logs ?? []
  const header = 'fecha,usuario,accion,recurso,id_recurso,ip\n'
  const csv = header + rows.map(r =>
    `"${r.created_at}","${r.actor_email ?? ''}","${r.action}","${r.resource_type}","${r.resource_id ?? ''}","${r.ip_address ?? ''}"`
  ).join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
