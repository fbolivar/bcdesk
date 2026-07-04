import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { TicketStatus, TicketPriority, TicketCategory } from '@/lib/supabase/types'
import { TICKET_CATEGORY_LABELS } from '@/lib/tickets/categories'

interface ExportTicket {
  ticket_number: number
  title: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  created_at: string
  resolved_at: string | null
}

const statusLabel: Record<TicketStatus, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  waiting_client: 'Esperando cliente',
  resolved: 'Resuelto',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
}

const priorityLabel: Record<TicketPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
}

const categoryLabel = TICKET_CATEGORY_LABELS

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'Sin organización' }, { status: 403 })
  }

  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('ticket_number, title, status, priority, category, created_at, resolved_at')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Error al obtener tickets' }, { status: 500 })
  }

  const rows: ExportTicket[] = tickets ?? []

  const header = ['#', 'Título', 'Estado', 'Prioridad', 'Categoría', 'Creado', 'Resuelto']
  const lines: string[] = [header.join(',')]

  for (const t of rows) {
    const line = [
      String(t.ticket_number),
      escapeCSV(t.title),
      statusLabel[t.status] ?? t.status,
      priorityLabel[t.priority] ?? t.priority,
      categoryLabel[t.category] ?? t.category,
      new Date(t.created_at).toLocaleDateString('es-CO'),
      t.resolved_at ? new Date(t.resolved_at).toLocaleDateString('es-CO') : '',
    ].join(',')
    lines.push(line)
  }

  const csv = lines.join('\n')
  const date = new Date().toISOString().split('T')[0]

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tickets-${date}.csv"`,
    },
  })
}
