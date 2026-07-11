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
    .select('created_at, actor_email, action, resource_type, resource_id, ip_address, profiles!actor_id(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(10000)

  const rows = (logs ?? []) as Array<Record<string, unknown> & { profiles?: { full_name?: string; email?: string } | { full_name?: string; email?: string }[] | null }>
  const header = 'fecha,usuario,accion,recurso,id_recurso,ip\n'
  const csv = header + rows.map(r => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    const usuario = p?.full_name || p?.email || (r.actor_email as string) || 'Sistema'
    return `"${r.created_at as string}","${usuario}","${r.action as string}","${r.resource_type as string}","${(r.resource_id as string) ?? ''}","${(r.ip_address as string) ?? ''}"`
  }).join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
