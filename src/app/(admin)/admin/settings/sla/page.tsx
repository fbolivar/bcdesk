import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { updateSlaPolicy, toggleSlaPolicy } from '@/features/admin/services/admin.service'
import { Clock, CheckCircle2, XCircle } from 'lucide-react'
import { TICKET_CATEGORY_LABELS } from '@/lib/tickets/categories'

function fmtMinutes(mins: number) {
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${Math.round(mins / 60)}h`
  return `${Math.round(mins / 1440)}d`
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'bg-[#EF4444]/20 text-[#EF4444]',
  high:     'bg-[#F59E0B]/20 text-[#F59E0B]',
  medium:   'bg-[#3B82F6]/20 text-[#3B82F6]',
  low:      'bg-[#64748B]/20 text-[#64748B]',
}
const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo',
}
const CATEGORY_LABEL = TICKET_CATEGORY_LABELS as Record<string, string>

export default async function AdminSlaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: policies } = await supabase
    .from('sla_policies')
    .select('*')
    .order('category').order('priority')

  const grouped = (policies ?? []).reduce<Record<string, typeof policies>>((acc, p) => {
    if (!p) return acc
    acc[p.category] = acc[p.category] ?? []
    acc[p.category]!.push(p)
    return acc
  }, {})

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Políticas SLA</h1>
        <p className="text-sm text-[#64748B] mt-0.5">
          Define tiempos de respuesta y resolución por categoría y prioridad
        </p>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E6EBF2] flex items-center gap-2">
            <Clock size={14} className="text-[#3B82F6]" />
            <h2 className="text-sm font-semibold text-[#1E293B]">{CATEGORY_LABEL[category] ?? category}</h2>
            <span className="text-xs text-[#64748B]">({items?.length} políticas)</span>
          </div>

          <div className="divide-y divide-[#E6EBF2]/50">
            {(items ?? []).map(policy => (
              <details key={policy.id} className="group">
                <summary className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-[#EEF2F7] transition-colors list-none">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${PRIORITY_COLOR[policy.priority]}`}>
                    {PRIORITY_LABEL[policy.priority]}
                  </span>
                  <span className="text-sm font-medium text-[#1E293B] flex-1">{policy.name}</span>
                  <div className="flex items-center gap-4 text-xs text-[#64748B]">
                    <span title="Tiempo de respuesta">⚡ {fmtMinutes(policy.response_time_minutes)}</span>
                    <span title="Tiempo de resolución">✓ {fmtMinutes(policy.resolution_time_minutes)}</span>
                    {policy.escalate_after_minutes && (
                      <span title="Escalada tras">🔺 {fmtMinutes(policy.escalate_after_minutes)}</span>
                    )}
                  </div>
                  {policy.is_active
                    ? <CheckCircle2 size={14} className="text-[#10B981] shrink-0" />
                    : <XCircle size={14} className="text-[#64748B] shrink-0" />
                  }
                  <span className="text-[10px] text-[#64748B] group-open:rotate-180 transition-transform">▼</span>
                </summary>

                <div className="px-5 pb-5 pt-3 border-t border-[#E6EBF2]/50 bg-[#F4F7FB]/30">
                  <form action={updateSlaPolicy} className="space-y-4">
                    <input type="hidden" name="id" value={policy.id} />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-[#64748B] mb-1.5">Nombre</label>
                        <input name="name" defaultValue={policy.name} required
                          className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                          Tiempo de respuesta <span className="text-[#64748B]">(minutos)</span>
                        </label>
                        <input name="response_time_minutes" type="number" min="1"
                          defaultValue={policy.response_time_minutes} required
                          className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
                        <p className="text-[10px] text-[#64748B] mt-1">= {fmtMinutes(policy.response_time_minutes)}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                          Tiempo de resolución <span className="text-[#64748B]">(minutos)</span>
                        </label>
                        <input name="resolution_time_minutes" type="number" min="1"
                          defaultValue={policy.resolution_time_minutes} required
                          className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
                        <p className="text-[10px] text-[#64748B] mt-1">= {fmtMinutes(policy.resolution_time_minutes)}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                          Escalada tras <span className="text-[#64748B]">(minutos, opcional)</span>
                        </label>
                        <input name="escalate_after_minutes" type="number" min="1"
                          defaultValue={policy.escalate_after_minutes ?? ''}
                          className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
                          placeholder="Sin escalada" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="submit"
                        className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
                        Guardar cambios
                      </button>
                    </div>
                  </form>

                  <form action={toggleSlaPolicy} className="mt-0">
                    <input type="hidden" name="id" value={policy.id} />
                    <input type="hidden" name="is_active" value={String(policy.is_active)} />
                    <button type="submit"
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        policy.is_active
                          ? 'border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10'
                          : 'border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/10'
                      }`}>
                      {policy.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </form>
                </div>
              </details>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
