import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Zap, Plus, CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import { createAutomationRule, toggleAutomationRule, deleteAutomationRule } from '@/features/admin/services/automation.service'

const CATEGORIES = ['support', 'development', 'billing', 'onboarding', 'other']
const CATEGORY_LABELS: Record<string, string> = {
  support: 'Soporte', development: 'Desarrollo', billing: 'Facturación',
  onboarding: 'Onboarding', other: 'Otro',
}
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica',
}

export default async function AutomationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [rulesRes, agentsRes] = await Promise.all([
    supabase.from('automation_rules').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'agent']).eq('is_active', true),
  ])

  const rules = rulesRes.data ?? []
  const agents = agentsRes.data ?? []

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Automatización</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">
          Reglas de auto-asignación al crear tickets
        </p>
      </div>

      {/* Create rule */}
      <details className="bg-[#1E293B] border border-[#334155] rounded-xl">
        <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] select-none flex items-center gap-2">
          <Plus size={14} className="text-[#3B82F6]" /> Nueva regla de asignación
        </summary>
        <form action={createAutomationRule} className="px-5 pb-5 pt-3 border-t border-[#334155] space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Nombre *</label>
              <input name="name" required placeholder="ej: Billing → Ana"
                className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors placeholder-[#64748B]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Categoría</label>
              <select name="category" defaultValue=""
                className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors">
                <option value="">Cualquiera</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Prioridad</label>
              <select name="priority" defaultValue=""
                className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors">
                <option value="">Cualquiera</option>
                {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Asignar a *</label>
            <select name="agent_id" required
              className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors">
              <option value="">Seleccionar agente</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
          <button type="submit"
            className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
            Crear regla
          </button>
        </form>
      </details>

      {/* Rules list */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#334155] flex items-center gap-2">
          <Zap size={14} className="text-[#3B82F6]" />
          <h2 className="text-sm font-semibold text-[#F1F5F9]">Reglas activas</h2>
          <span className="text-xs text-[#64748B]">({rules.length})</span>
        </div>
        {rules.length === 0 ? (
          <p className="text-center text-sm text-[#64748B] py-10">Sin reglas. Crea la primera arriba.</p>
        ) : (
          <div className="divide-y divide-[#334155]/50">
            {rules.map(rule => {
              const conds = rule.conditions as Record<string, string> | null
              const actions = rule.actions as Record<string, string> | null
              const agentName = agents.find(a => a.id === actions?.assign_to)?.full_name ?? actions?.assign_to ?? '—'
              return (
                <div key={rule.id} className="flex items-center gap-3 px-5 py-3">
                  {rule.is_active
                    ? <CheckCircle2 size={14} className="text-[#10B981] shrink-0" />
                    : <XCircle size={14} className="text-[#64748B] shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#F1F5F9]">{rule.name}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {conds?.category ? `Categoría: ${CATEGORY_LABELS[conds.category] ?? conds.category}` : 'Cualquier categoría'}
                      {conds?.priority ? ` · Prioridad: ${PRIORITY_LABELS[conds.priority] ?? conds.priority}` : ''}
                      {' → '}<span className="text-[#94A3B8]">{agentName}</span>
                    </p>
                  </div>
                  <span className="text-[10px] text-[#64748B]">{rule.execution_count ?? 0} ejecuciones</span>
                  <div className="flex gap-1.5">
                    <form action={toggleAutomationRule}>
                      <input type="hidden" name="id" value={rule.id} />
                      <input type="hidden" name="is_active" value={String(rule.is_active)} />
                      <button type="submit"
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          rule.is_active
                            ? 'border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10'
                            : 'border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/10'
                        }`}>
                        {rule.is_active ? 'Pausar' : 'Activar'}
                      </button>
                    </form>
                    <form action={deleteAutomationRule}>
                      <input type="hidden" name="id" value={rule.id} />
                      <button type="submit" className="p-1.5 text-[#64748B] hover:text-[#EF4444] transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
