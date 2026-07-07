import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Link2, Unlink } from 'lucide-react'
import { updateProblem, linkTicketToProblem, unlinkTicketFromProblem } from '@/features/admin/services/problems.service'

interface Props { params: Promise<{ id: string }> }

const STATUS_OPTS = [
  { value: 'open', label: 'Abierto' },
  { value: 'investigating', label: 'Investigando' },
  { value: 'known_error', label: 'Error conocido' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'closed', label: 'Cerrado' },
]

export default async function ProblemDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: problem } = await supabase
    .from('problems')
    .select('*')
    .eq('id', id)
    .single()

  if (!problem) redirect('/admin/problems')

  const { data: linkedTickets } = await supabase
    .from('problem_incidents')
    .select('ticket_id, tickets(id, title, status, priority)')
    .eq('problem_id', id)

  const { data: openTickets } = await supabase
    .from('tickets')
    .select('id, title')
    .is('problem_id', null)
    .in('status', ['open','in_progress'])
    .limit(30)

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/problems" className="flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">
        <ArrowLeft size={14} /> Volver a problemas
      </Link>

      <h1 className="text-xl font-semibold text-[#0B2545]">{problem.title}</h1>

      {/* Edit form */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#0B2545]">Detalles del problema</h2>
        <form action={updateProblem.bind(null, id)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Estado</label>
              <select name="status" defaultValue={problem.status}
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Prioridad</label>
              <select name="priority" defaultValue={problem.priority}
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Título</label>
            <input name="title" defaultValue={problem.title}
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Descripción / Síntomas</label>
            <textarea name="description" rows={3} defaultValue={problem.description ?? ''}
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] resize-none" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Causa raíz</label>
            <textarea name="root_cause" rows={2} defaultValue={problem.root_cause ?? ''}
              placeholder="Análisis de causa raíz (RCA)..."
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1] resize-none" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Solución temporal (workaround)</label>
            <textarea name="workaround" rows={2} defaultValue={problem.workaround ?? ''}
              placeholder="Pasos para mitigar el impacto mientras se resuelve el problema..."
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1] resize-none" />
          </div>
          <div className="flex justify-end">
            <button type="submit"
              className="px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              Guardar cambios
            </button>
          </div>
        </form>
      </div>

      {/* Linked incidents */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#0B2545]">Incidentes vinculados ({linkedTickets?.length ?? 0})</h2>
        {(linkedTickets ?? []).length > 0 && (
          <div className="space-y-2">
            {linkedTickets!.map((pi: any) => {
              const t = Array.isArray(pi.tickets) ? pi.tickets[0] : pi.tickets
              return (
                <div key={pi.ticket_id} className="flex items-center justify-between px-3 py-2 bg-[#F4F7FB] rounded-lg">
                  <Link href={`/admin/tickets/${pi.ticket_id}`} className="text-sm text-[#0B2545] hover:text-[#1789FC]">
                    {t?.title ?? pi.ticket_id}
                  </Link>
                  <form action={unlinkTicketFromProblem.bind(null, id, pi.ticket_id)}>
                    <button type="submit" title="Desvincular"
                      className="p-1 rounded text-[#5B6B7C] hover:text-[#EF4444] transition-colors">
                      <Unlink size={14} />
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        )}

        {/* Link a ticket */}
        {(openTickets ?? []).length > 0 && (
          <form action={async (fd: FormData) => {
            'use server'
            const ticketId = fd.get('ticket_id') as string
            if (ticketId) await linkTicketToProblem(id, ticketId)
          }} className="flex gap-2">
            <select name="ticket_id"
              className="flex-1 px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="">Selecciona un ticket para vincular...</option>
              {(openTickets ?? []).map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <button type="submit"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#0B2545] text-sm transition-colors">
              <Link2 size={14} /> Vincular
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
