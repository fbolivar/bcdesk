import { createServiceClient } from '@/lib/supabase/service'
import { sendNewTicketStaffEmail } from '@/lib/email/ticket-emails'
import { sendPushToUser } from '@/lib/push/send'

/** Notifica al equipo (admin/agentes activos) que entró un ticket nuevo:
 *  correo + push. Usa service client porque quien crea el ticket suele ser
 *  un cliente que por RLS no puede leer los perfiles del staff. Nunca lanza. */
export async function notifyStaffNewTicket(params: {
  ticketId: string; ticketNumber: number; title: string; priority: string; orgName?: string | null
}) {
  try {
    const svc = createServiceClient()
    const { data: staff } = await svc.from('profiles')
      .select('id, email').in('role', ['admin', 'agent']).eq('is_active', true)
    const list = staff ?? []
    if (!list.length) return

    const emails = list.map(s => s.email as string).filter(Boolean)
    if (emails.length) {
      sendNewTicketStaffEmail({
        to: emails.join(', '), ticketId: params.ticketId, ticketNumber: params.ticketNumber,
        title: params.title, priority: params.priority, orgName: params.orgName,
      }).catch(() => {})
    }
    for (const s of list) {
      sendPushToUser(s.id as string, `Nuevo ticket #${params.ticketNumber}`, params.title, `/admin/tickets/${params.ticketId}`).catch(() => {})
    }
  } catch {
    // no bloquear la creación del ticket
  }
}
