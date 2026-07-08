import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const format = searchParams.get('format') ?? 'csv'

  let query = supabase
    .from('tickets')
    .select(`
      id, title, status, priority, category, source,
      created_at, updated_at, resolved_at,
      profiles!tickets_created_by_fkey(full_name, email),
      organizations(name),
      assignee:profiles!tickets_assigned_to_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data: tickets } = await query

  const rows = (tickets ?? []).map((t: any) => {
    const requester = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles
    const org = Array.isArray(t.organizations) ? t.organizations[0] : t.organizations
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    return {
      ID: t.id,
      Título: t.title,
      Estado: t.status,
      Prioridad: t.priority,
      Categoría: t.category ?? '',
      Fuente: t.source ?? '',
      Solicitante: requester?.full_name ?? '',
      Email: requester?.email ?? '',
      Organización: org?.name ?? '',
      Asignado: assignee?.full_name ?? '',
      Creado: t.created_at ? new Date(t.created_at).toLocaleString('es-CO') : '',
      Actualizado: t.updated_at ? new Date(t.updated_at).toLocaleString('es-CO') : '',
      Resuelto: t.resolved_at ? new Date(t.resolved_at).toLocaleString('es-CO') : '',
    }
  })

  if (format === 'json') {
    return NextResponse.json(rows, {
      headers: { 'Content-Disposition': 'attachment; filename="tickets.json"' },
    })
  }

  // CSV
  if (rows.length === 0) {
    return new NextResponse('Sin resultados', { status: 200 })
  }

  const headers = Object.keys(rows[0])
  const csvLines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const val = String((r as Record<string, unknown>)[h] ?? '')
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val
    }).join(',')),
  ]

  return new NextResponse(csvLines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tickets.csv"',
    },
  })
}
