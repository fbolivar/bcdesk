import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = {
  slack: 'Slack',
  teams: 'Microsoft Teams',
  whatsapp: 'WhatsApp Business',
  webhook: 'Webhook genérico',
}
const TYPE_COLOR: Record<string, string> = {
  slack: 'bg-[#4A154B]/20 text-[#E01E5A]',
  teams: 'bg-[#5059C9]/20 text-[#5059C9]',
  whatsapp: 'bg-[#25D366]/20 text-[#25D366]',
  webhook: 'bg-[#E6EBF2] text-[#5B6B7C]',
}
const EVENTS = ['ticket.created','ticket.resolved','ticket.assigned','ticket.escalated','chat.new_session']

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: integrations } = await supabase
    .from('webhook_integrations')
    .select('*')
    .order('created_at', { ascending: false })

  const list = integrations ?? []

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const eventsRaw = formData.getAll('events') as string[]
    await supabase.from('webhook_integrations').insert({
      name: formData.get('name') as string,
      integration_type: formData.get('integration_type') as string,
      webhook_url: formData.get('webhook_url') as string,
      events: eventsRaw,
      created_by: user?.id,
    })
    revalidatePath('/admin/settings/integrations')
  }

  async function handleToggle(id: string, current: boolean) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('webhook_integrations').update({ is_active: !current }).eq('id', id)
    revalidatePath('/admin/settings/integrations')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('webhook_integrations').delete().eq('id', id)
    revalidatePath('/admin/settings/integrations')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Integraciones</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Conecta HexDesk con Slack, Teams, WhatsApp y webhooks</p>
      </div>

      {/* Docs tip */}
      <div className="flex items-start gap-3 px-4 py-3 bg-[#1789FC]/10 border border-[#1789FC]/20 rounded-xl">
        <Zap size={14} className="text-[#1789FC] shrink-0 mt-0.5" />
        <p className="text-xs text-[#5B6B7C]">
          Para <strong className="text-[#0B2545]">Slack</strong>: crea una Incoming Webhook en api.slack.com/apps · Para <strong className="text-[#0B2545]">Teams</strong>: usa un Incoming Webhook connector en tu canal · Para <strong className="text-[#0B2545]">WhatsApp</strong>: conecta via Twilio o Meta Business API
        </p>
      </div>

      {/* Create */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Nueva integración</h2>
        <form action={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Nombre *</label>
              <input name="name" required placeholder="ej: Canal #soporte en Slack"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
            </div>
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Tipo</label>
              <select name="integration_type" defaultValue="slack"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">URL del Webhook *</label>
            <input name="webhook_url" required type="url" placeholder="https://hooks.slack.com/services/..."
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-2">Eventos que disparan la notificación</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVENTS.map(e => (
                <label key={e} className="flex items-center gap-2 text-xs text-[#5B6B7C] cursor-pointer">
                  <input type="checkbox" name="events" value={e} className="rounded" />
                  {e}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Agregar integración
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {list.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Integración', 'Tipo', 'Eventos', 'Último envío', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((i: any) => (
                <tr key={i.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#0B2545]">{i.name}</p>
                    <p className="text-[10px] text-[#CBD5E1] font-mono truncate max-w-[160px]">{i.webhook_url}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[i.integration_type]}`}>
                      {TYPE_LABEL[i.integration_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{i.events?.length ?? 0} eventos</td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">
                    {i.last_triggered_at ? new Date(i.last_triggered_at).toLocaleDateString('es-CO') : 'Nunca'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#E6EBF2] text-[#5B6B7C]'}`}>
                      {i.is_active ? 'Activa' : 'Pausada'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <form action={handleToggle.bind(null, i.id, i.is_active)}>
                        <button type="submit"
                          className="p-1.5 rounded text-[#5B6B7C] hover:text-[#F59E0B] transition-colors">
                          {i.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                      </form>
                      <form action={handleDelete.bind(null, i.id)}>
                        <button type="submit"
                          className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}
