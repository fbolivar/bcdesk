import Link from 'next/link'
import { Clock, MessageSquare } from 'lucide-react'
import type { Ticket } from '@/lib/supabase/types'
import { PriorityBadge, StatusBadge } from './priority-badge'
import { SLATimer } from './sla-timer'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface TicketCardProps {
  ticket: Ticket
  href: string
  showOrg?: boolean
}

export function TicketCard({ ticket, href, showOrg = false }: TicketCardProps) {
  return (
    <Link
      href={href}
      className="block bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 hover:border-[#3B82F6]/40 hover:bg-[#EEF2F7] transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-[#64748B]">#{ticket.ticket_number}</span>
            {showOrg && ticket.organization && (
              <span className="text-xs text-[#64748B]">{ticket.organization.name}</span>
            )}
          </div>
          <h3 className="text-sm font-medium text-[#1E293B] truncate">{ticket.title}</h3>
          <p className="text-xs text-[#64748B] mt-1 line-clamp-1">{ticket.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[#E6EBF2]/50">
        <SLATimer
          dueAt={ticket.sla_resolution_due_at}
          createdAt={ticket.created_at}
        />
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <Clock size={12} />
          <span>{formatDistanceToNow(new Date(ticket.created_at), { locale: es, addSuffix: true })}</span>
        </div>
        {ticket.assigned_to_profile && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-[#E6EBF2] flex items-center justify-center text-[10px] text-[#1E293B]">
              {ticket.assigned_to_profile.full_name.charAt(0)}
            </div>
            <span className="text-xs text-[#64748B]">{ticket.assigned_to_profile.full_name}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
