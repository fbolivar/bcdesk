import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface AuditEntry {
  id: string
  action: string
  new_values: Record<string, unknown> | null
  old_values: Record<string, unknown> | null
  created_at: string
  profiles?: { full_name: string } | null
}

const ACTION_LABEL: Record<string, string> = {
  created: 'creó el ticket',
  status_changed: 'cambió el estado',
  priority_changed: 'cambió la prioridad',
  assigned: 'asignó el ticket',
  comment_added: 'añadió un comentario',
  resolved: 'resolvió el ticket',
  reopened: 'reabrió el ticket',
  merged: 'fusionó el ticket',
  tags_updated: 'actualizó las etiquetas',
  rating_submitted: 'calificó el ticket',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto', in_progress: 'En progreso', waiting_client: 'Esperando cliente',
  resolved: 'Resuelto', closed: 'Cerrado', cancelled: 'Cancelado', merged: 'Fusionado',
}

function getDetail(entry: AuditEntry): string | null {
  const nv = entry.new_values
  if (!nv) return null
  if (entry.action === 'status_changed' && nv.status) {
    const from = entry.old_values?.status as string | undefined
    const to = nv.status as string
    return from ? `${STATUS_LABEL[from] ?? from} → ${STATUS_LABEL[to] ?? to}` : STATUS_LABEL[to] ?? to
  }
  if (entry.action === 'priority_changed' && nv.priority) return String(nv.priority)
  if (entry.action === 'assigned' && nv.assigned_to) return 'nuevo agente asignado'
  if (entry.action === 'rating_submitted' && nv.score) return `${nv.score}/5 estrellas`
  return null
}

export function TicketTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return null

  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Historial de actividad</h3>
      <div className="relative pl-4 border-l border-[#E6EBF2]/50 space-y-3">
        {entries.map(entry => {
          const detail = getDetail(entry)
          return (
            <div key={entry.id} className="flex items-start gap-2 text-xs">
              <div className="absolute -left-1 w-2 h-2 rounded-full bg-[#E6EBF2] mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-[#64748B] font-medium">
                  {entry.profiles?.full_name ?? 'Sistema'}
                </span>
                <span className="text-[#64748B]"> {ACTION_LABEL[entry.action] ?? entry.action}</span>
                {detail && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-[#E6EBF2] text-[#64748B]">{detail}</span>
                )}
              </div>
              <span className="text-[#64748B] shrink-0 whitespace-nowrap">
                {formatDistanceToNow(new Date(entry.created_at), { locale: es, addSuffix: true })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
