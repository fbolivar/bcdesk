import type { TicketPriority, TicketStatus } from '@/lib/supabase/types'

const priorityConfig: Record<TicketPriority, { label: string; style: React.CSSProperties }> = {
  low:      { label: 'Baja',    style: { background: 'rgba(139,155,180,0.12)', color: '#5B6B7C' } },
  medium:   { label: 'Media',   style: { background: 'rgba(255,181,71,0.12)',  color: '#FFB547' } },
  high:     { label: 'Alta',    style: { background: 'rgba(255,77,106,0.12)',  color: '#FF4D6A' } },
  critical: { label: 'Crítica', style: { background: 'rgba(255,77,106,0.9)',   color: '#fff', boxShadow: '0 0 8px rgba(255,77,106,0.4)' } },
}

const statusConfig: Record<TicketStatus, { label: string; style: React.CSSProperties }> = {
  open:           { label: 'Abierto',          style: { background: 'rgba(23,137,252,0.12)', color: '#1789FC' } },
  in_progress:    { label: 'En progreso',       style: { background: 'rgba(0,212,255,0.12)',  color: '#00D4AA' } },
  waiting_client: { label: 'Esp. cliente',      style: { background: 'rgba(255,181,71,0.12)', color: '#FFB547' } },
  resolved:       { label: 'Resuelto',          style: { background: 'rgba(16,217,138,0.12)', color: '#10D98A' } },
  closed:         { label: 'Cerrado',           style: { background: 'rgba(74,85,104,0.2)',   color: '#94A3B8' } },
  cancelled:      { label: 'Cancelado',         style: { background: 'rgba(74,85,104,0.12)',  color: '#94A3B8' } },
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const config = priorityConfig[priority]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={config.style}
    >
      {config.label}
    </span>
  )
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const config = statusConfig[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={config.style}
    >
      {config.label}
    </span>
  )
}
