import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { Inbox, Mail, MessageSquare, Phone, Globe, CheckCircle2 } from 'lucide-react'

const CHANNEL_CONFIG: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  email: { label: 'Email', icon: Mail, color: 'text-[#0E9E86]' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'text-[#25D366]' },
  twitter: { label: 'Twitter/X', icon: Globe, color: 'text-[#1DA1F2]' },
  instagram: { label: 'Instagram', icon: Globe, color: 'text-[#E1306C]' },
  sms: { label: 'SMS', icon: Phone, color: 'text-[#F59E0B]' },
  telegram: { label: 'Telegram', icon: MessageSquare, color: 'text-[#0088CC]' },
}

export default async function MultichannelInboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) redirect('/dashboard')

  const { data: messages, count } = await supabase
    .from('multichannel_messages')
    .select('*, tickets(id, title, status)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100)

  const list = messages ?? []
  const unprocessed = list.filter(m => !m.is_processed)

  // Channel stats
  const byChannel: Record<string, { total: number; unprocessed: number }> = {}
  for (const m of list) {
    if (!byChannel[m.channel]) byChannel[m.channel] = { total: 0, unprocessed: 0 }
    byChannel[m.channel].total++
    if (!m.is_processed) byChannel[m.channel].unprocessed++
  }

  async function handleProcess(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('multichannel_messages').update({ is_processed: true }).eq('id', id)
    revalidatePath('/admin/inbox')
  }

  async function handleCreateTicket(msgId: string, formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (me?.role !== 'admin' && me?.role !== 'agent') throw new Error('Sin permiso')

    const { data: msg } = await supabase.from('multichannel_messages').select('*').eq('id', msgId).single()
    if (!msg) throw new Error('El mensaje no existe.')

    // created_by y category son NOT NULL y no se enviaban: el insert fallaba, el
    // error se ignoraba, el mensaje nunca se marcaba procesado y reaparecía en la
    // bandeja para siempre. Sin organization_id el ticket nace interno, que es lo
    // correcto: no sabemos de qué cliente es hasta que lo asignes.
    const { data: ticket, error } = await supabase.from('tickets').insert({
      title: msg.subject ?? `Mensaje de ${msg.channel}: ${msg.from_address}`,
      description: msg.body,
      status: 'open',
      priority: 'medium',
      category: 'support',
      source_channel: msg.channel,
      created_by: user.id,
      requester_email: msg.from_address ?? null,
    }).select('id').single()
    if (error || !ticket) throw new Error('No se pudo crear el ticket desde el mensaje.')

    const { error: linkErr } = await supabase
      .from('multichannel_messages')
      .update({ ticket_id: ticket.id, is_processed: true }).eq('id', msgId)
    if (linkErr) throw new Error('El ticket se creó, pero el mensaje sigue sin marcarse como procesado.')

    revalidatePath('/admin/inbox')
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">Bandeja unificada</h1>
          <p className="text-sm text-[#5B6B7C] mt-0.5">
            Todos los canales en una sola vista · {unprocessed.length} sin procesar
          </p>
        </div>
      </div>

      {/* Channel stats */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(byChannel).map(([ch, stats]) => {
          const cfg = CHANNEL_CONFIG[ch]
          const Icon = cfg?.icon ?? Globe
          return (
            <div key={ch} className="flex items-center gap-2 px-3 py-2 bg-[#FFFFFF] border border-[#E6EBF2] rounded-lg">
              <Icon size={14} className={cfg?.color ?? 'text-[#5B6B7C]'} />
              <span className="text-sm font-medium text-[#0B2545]">{cfg?.label ?? ch}</span>
              {stats.unprocessed > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EF4444] text-white">
                  {stats.unprocessed}
                </span>
              )}
              <span className="text-xs text-[#CBD5E1]">{stats.total} total</span>
            </div>
          )
        })}
        {Object.keys(byChannel).length === 0 && (
          <p className="text-xs text-[#CBD5E1]">Sin mensajes aún. Los webhooks de email/WhatsApp enviarán mensajes aquí.</p>
        )}
      </div>

      {/* Webhook setup info */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-3">Configurar canales de entrada</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {[
            { label: 'Email (SendGrid / Postmark)', url: '/api/webhooks/email-inbound', note: 'Apunta el webhook de Inbound Parse aquí' },
            { label: 'WhatsApp (Twilio / Meta)', url: '/api/webhooks/whatsapp', note: 'Configura el webhook en Meta Business o Twilio' },
            { label: 'API genérica', url: '/api/webhooks/multichannel', note: 'POST con channel, from_address, body' },
          ].map(c => (
            <div key={c.url} className="bg-[#F4F7FB] rounded-lg p-3">
              <p className="font-medium text-[#0B2545] mb-1">{c.label}</p>
              <code className="text-[#0E9E86] text-[10px] break-all">{c.url}</code>
              <p className="text-[#CBD5E1] mt-1">{c.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Messages list */}
      {list.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Canal', 'De', 'Asunto / Mensaje', 'Ticket', 'Recibido', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((msg: any) => {
                const cfg = CHANNEL_CONFIG[msg.channel]
                const Icon = cfg?.icon ?? Globe
                const ticket = Array.isArray(msg.tickets) ? msg.tickets[0] : msg.tickets
                return (
                  <tr key={msg.id} className={`border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7] ${!msg.is_processed ? 'bg-[#00D4AA]/5' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Icon size={13} className={cfg?.color ?? 'text-[#5B6B7C]'} />
                        <span className="text-xs font-medium text-[#5B6B7C]">{cfg?.label ?? msg.channel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-[#0B2545]">{msg.from_name || msg.from_address}</p>
                      {msg.from_name && <p className="text-[10px] text-[#CBD5E1]">{msg.from_address}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-[250px]">
                      {msg.subject && <p className="text-xs font-medium text-[#0B2545] truncate">{msg.subject}</p>}
                      <p className="text-xs text-[#5B6B7C] truncate">{msg.body}</p>
                    </td>
                    <td className="px-4 py-3">
                      {ticket ? (
                        <Link href={`/admin/tickets/${ticket.id}`}
                          className="text-xs text-[#0E9E86] hover:underline">
                          #{ticket.id?.slice(0, 8)} — {ticket.title?.slice(0, 20)}
                        </Link>
                      ) : (
                        <form action={handleCreateTicket.bind(null, msg.id, new FormData())}>
                          <button type="submit"
                            className="text-xs px-2 py-1 rounded border border-[#00D4AA]/30 text-[#0E9E86] hover:bg-[#00D4AA]/10 transition-colors">
                            + Crear ticket
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#CBD5E1] whitespace-nowrap">
                      {new Date(msg.created_at).toLocaleString('es-CO')}
                    </td>
                    <td className="px-4 py-3">
                      {!msg.is_processed ? (
                        <form action={handleProcess.bind(null, msg.id)}>
                          <button type="submit"
                            className="p-1.5 rounded text-[#5B6B7C] hover:text-[#10B981] hover:bg-[#10B981]/10 transition-colors"
                            title="Marcar procesado">
                            <CheckCircle2 size={14} />
                          </button>
                        </form>
                      ) : (
                        <CheckCircle2 size={14} className="text-[#10B981] opacity-40" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Inbox size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Bandeja vacía. Configura los webhooks para recibir mensajes.</p>
        </div>
      )}
    </div>
  )
}
