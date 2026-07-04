import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Cpu, Trash2, Plus, Zap } from 'lucide-react'
import {
  createSkill,
  deleteSkill,
  assignSkillToAgent,
  removeSkillFromAgent,
  createRoutingRule,
  deleteRoutingRule,
  toggleRoutingRule,
} from '@/features/admin/services/skills-routing.actions'

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface Skill {
  id: string
  name: string
  description: string | null
  category: string
  color: string
  created_at: string
}

interface AgentSkillRow {
  agent_id: string
  skill_id: string
  level: number
  skills: Skill
}

interface AgentWithSkills {
  id: string
  full_name: string
  email: string
  role: string
  agent_skills: AgentSkillRow[]
}

interface RoutingRule {
  id: string
  name: string
  skill_id: string
  ticket_category: string | null
  ticket_priority: string | null
  is_active: boolean
  created_at: string
  skills: Skill
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  technical: 'Técnico',
  billing: 'Facturación',
  product: 'Producto',
  language: 'Idioma',
  other: 'Otro',
}

const TICKET_CATEGORY_LABELS: Record<string, string> = {
  support: 'Soporte',
  development: 'Desarrollo',
  billing: 'Facturación',
  onboarding: 'Onboarding',
  other: 'Otro',
}

const TICKET_PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#10D98A',
  medium: '#FFB547',
  high: '#FF6B6B',
  critical: '#FF4D6A',
}

function LevelDots({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: i <= level ? '#4F8AFF' : '#E6EBF2' }}
        />
      ))}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SkillsRoutingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/admin/dashboard')

  // Datos
  const { data: skillsRaw } = await supabase
    .from('skills')
    .select('*')
    .order('category')
    .order('name')

  const { data: agentsRaw } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, agent_skills(agent_id, skill_id, level, skills(*))')
    .in('role', ['admin', 'agent'])
    .eq('is_active', true)
    .order('full_name')

  const { data: rulesRaw } = await supabase
    .from('routing_rules')
    .select('*, skills(*)')
    .order('created_at', { ascending: false })

  const skills = (skillsRaw ?? []) as Skill[]
  const agents = (agentsRaw ?? []) as unknown as AgentWithSkills[]
  const rules = (rulesRaw ?? []) as RoutingRule[]

  // ── Server Actions inline ─────────────────────────────────────────────────

  async function handleDeleteSkill(formData: FormData) {
    'use server'
    const id = formData.get('skill_id') as string
    await deleteSkill(id)
  }

  async function handleAssignSkill(formData: FormData) {
    'use server'
    const agentId = formData.get('agent_id') as string
    const skillId = formData.get('skill_id') as string
    const level = parseInt(formData.get('level') as string, 10) || 1
    await assignSkillToAgent(agentId, skillId, level)
  }

  async function handleRemoveAgentSkill(formData: FormData) {
    'use server'
    const agentId = formData.get('agent_id') as string
    const skillId = formData.get('skill_id') as string
    await removeSkillFromAgent(agentId, skillId)
  }

  async function handleDeleteRule(formData: FormData) {
    'use server'
    const id = formData.get('rule_id') as string
    await deleteRoutingRule(id)
  }

  async function handleToggleRule(formData: FormData) {
    'use server'
    const id = formData.get('rule_id') as string
    const current = formData.get('is_active') === 'true'
    await toggleRoutingRule(id, !current)
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B] flex items-center gap-2">
          <Cpu size={20} className="text-[#4F8AFF]" />
          Routing de Skills
        </h1>
        <p className="text-sm text-[#64748B] mt-0.5">
          Asignación automática de tickets a agentes según sus habilidades y especialidades
        </p>
      </div>

      {/* ══ Sección 1: Skills del sistema ══ */}
      <section>
        <h2 className="text-sm font-semibold text-[#1E293B] mb-3">Skills del sistema</h2>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          {/* Lista de skills */}
          {skills.length === 0 && (
            <p className="px-4 py-6 text-sm text-[#64748B] text-center">
              No hay skills definidos aún.
            </p>
          )}
          {skills.map(skill => (
            <div
              key={skill.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-[#E6EBF2]/50 last:border-0"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: skill.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1E293B]">{skill.name}</p>
                {skill.description && (
                  <p className="text-xs text-[#64748B] truncate">{skill.description}</p>
                )}
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E6EBF2] text-[#64748B] shrink-0">
                {CATEGORY_LABELS[skill.category] ?? skill.category}
              </span>
              <form action={handleDeleteSkill}>
                <input type="hidden" name="skill_id" value={skill.id} />
                <button
                  type="submit"
                  title="Eliminar skill"
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </form>
            </div>
          ))}

          {/* Form inline nuevo skill */}
          <div className="px-4 py-4 border-t border-[#E6EBF2] bg-[#F4F7FB]/40">
            <p className="text-xs font-semibold text-[#64748B] mb-3 flex items-center gap-1.5">
              <Plus size={12} /> Nuevo skill
            </p>
            <form action={createSkill} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <input
                name="name"
                required
                placeholder="Nombre del skill"
                className="col-span-2 sm:col-span-1 px-3 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#4F8AFF] transition-colors placeholder-[#64748B]"
              />
              <input
                name="description"
                placeholder="Descripción (opcional)"
                className="col-span-2 sm:col-span-1 px-3 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#4F8AFF] transition-colors placeholder-[#64748B]"
              />
              <select
                name="category"
                defaultValue="technical"
                className="px-3 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#4F8AFF] transition-colors"
              >
                <option value="technical">Técnico</option>
                <option value="billing">Facturación</option>
                <option value="product">Producto</option>
                <option value="language">Idioma</option>
                <option value="other">Otro</option>
              </select>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#64748B] shrink-0">Color:</label>
                <input
                  name="color"
                  type="color"
                  defaultValue="#4F8AFF"
                  className="w-9 h-8 rounded-lg border border-[#E6EBF2] bg-[#F4F7FB] cursor-pointer p-0.5"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4F8AFF] hover:bg-[#3D7AEE] text-white text-xs font-medium transition-colors ml-auto"
                >
                  <Plus size={12} /> Agregar
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ══ Sección 2: Skills por agente ══ */}
      <section>
        <h2 className="text-sm font-semibold text-[#1E293B] mb-3">Skills por agente</h2>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          {agents.length === 0 && (
            <p className="px-4 py-6 text-sm text-[#64748B] text-center">
              No hay agentes activos.
            </p>
          )}
          {agents.map(agent => (
            <div key={agent.id} className="border-b border-[#E6EBF2]/50 last:border-0">
              {/* Fila agente */}
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-[#E6EBF2] flex items-center justify-center text-sm font-medium text-[#1E293B] shrink-0">
                  {agent.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-[#1E293B]">{agent.full_name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      agent.role === 'admin'
                        ? 'bg-[#4F8AFF]/15 text-[#4F8AFF]'
                        : 'bg-[#00D4FF]/15 text-[#00D4FF]'
                    }`}>
                      {agent.role === 'admin' ? 'Admin' : 'Agente'}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B]">{agent.email}</p>

                  {/* Chips de skills actuales */}
                  {agent.agent_skills && agent.agent_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {agent.agent_skills.map(as => (
                        <div
                          key={as.skill_id}
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                          style={{
                            background: `${as.skills.color}18`,
                            border: `1px solid ${as.skills.color}40`,
                            color: as.skills.color,
                          }}
                        >
                          {as.skills.name}
                          <LevelDots level={as.level} />
                          <form action={handleRemoveAgentSkill} className="inline">
                            <input type="hidden" name="agent_id" value={agent.id} />
                            <input type="hidden" name="skill_id" value={as.skill_id} />
                            <button
                              type="submit"
                              title="Quitar skill"
                              className="opacity-60 hover:opacity-100 transition-opacity ml-0.5"
                            >
                              ×
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Form asignar skill */}
              <form action={handleAssignSkill} className="flex items-center gap-2 px-4 pb-3 pl-[3.25rem]">
                <select
                  name="skill_id"
                  className="flex-1 px-2 py-1 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#64748B] text-xs focus:outline-none focus:border-[#4F8AFF] transition-colors"
                >
                  <option value="">— Asignar skill —</option>
                  {skills.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  name="level"
                  defaultValue="3"
                  className="w-24 px-2 py-1 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#64748B] text-xs focus:outline-none focus:border-[#4F8AFF] transition-colors"
                >
                  <option value="1">Nivel 1</option>
                  <option value="2">Nivel 2</option>
                  <option value="3">Nivel 3</option>
                  <option value="4">Nivel 4</option>
                  <option value="5">Nivel 5</option>
                </select>
                <input type="hidden" name="agent_id" value={agent.id} />
                <button
                  type="submit"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#4F8AFF]/10 hover:bg-[#4F8AFF]/20 text-[#4F8AFF] text-xs font-medium transition-colors border border-[#4F8AFF]/20"
                >
                  <Plus size={11} /> Asignar
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {/* ══ Sección 3: Reglas de routing ══ */}
      <section>
        <h2 className="text-sm font-semibold text-[#1E293B] mb-3">Reglas de routing automático</h2>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          {/* Header tabla */}
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-[#E6EBF2] bg-[#F4F7FB]/30">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Nombre</span>
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Skill</span>
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Categoría</span>
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Prioridad</span>
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Estado</span>
          </div>

          {rules.length === 0 && (
            <p className="px-4 py-6 text-sm text-[#64748B] text-center">
              No hay reglas configuradas.
            </p>
          )}

          {rules.map(rule => (
            <div
              key={rule.id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-center px-4 py-3 border-b border-[#E6EBF2]/50 last:border-0"
            >
              <span className="text-sm text-[#1E293B] truncate">{rule.name}</span>

              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: rule.skills?.color ?? '#4F8AFF' }}
                />
                <span className="text-xs text-[#64748B] truncate">
                  {rule.skills?.name ?? '—'}
                </span>
              </div>

              <span className="text-xs text-[#64748B]">
                {rule.ticket_category
                  ? (TICKET_CATEGORY_LABELS[rule.ticket_category] ?? rule.ticket_category)
                  : <span className="text-[#94A3B8]">Cualquiera</span>
                }
              </span>

              <span
                className="text-xs font-medium"
                style={{
                  color: rule.ticket_priority
                    ? PRIORITY_COLORS[rule.ticket_priority] ?? '#64748B'
                    : '#94A3B8',
                }}
              >
                {rule.ticket_priority
                  ? (TICKET_PRIORITY_LABELS[rule.ticket_priority] ?? rule.ticket_priority)
                  : 'Cualquiera'
                }
              </span>

              <div className="flex items-center gap-1.5">
                {/* Toggle activo/inactivo */}
                <form action={handleToggleRule}>
                  <input type="hidden" name="rule_id" value={rule.id} />
                  <input type="hidden" name="is_active" value={String(rule.is_active)} />
                  <button
                    type="submit"
                    title={rule.is_active ? 'Desactivar regla' : 'Activar regla'}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium border transition-colors ${
                      rule.is_active
                        ? 'bg-[#10D98A]/10 border-[#10D98A]/30 text-[#10D98A] hover:bg-[#10D98A]/20'
                        : 'bg-[#E6EBF2]/50 border-[#E6EBF2] text-[#64748B] hover:bg-[#E6EBF2]'
                    }`}
                  >
                    {rule.is_active ? 'Activa' : 'Inactiva'}
                  </button>
                </form>

                {/* Eliminar */}
                <form action={handleDeleteRule}>
                  <input type="hidden" name="rule_id" value={rule.id} />
                  <button
                    type="submit"
                    title="Eliminar regla"
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </form>
              </div>
            </div>
          ))}

          {/* Form nueva regla */}
          <div className="px-4 py-4 border-t border-[#E6EBF2] bg-[#F4F7FB]/40">
            <p className="text-xs font-semibold text-[#64748B] mb-3 flex items-center gap-1.5">
              <Zap size={12} className="text-[#4F8AFF]" /> Nueva regla de routing
            </p>
            <form action={createRoutingRule} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <input
                name="name"
                required
                placeholder="Nombre de la regla"
                className="col-span-2 sm:col-span-1 px-3 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#4F8AFF] transition-colors placeholder-[#64748B]"
              />
              <select
                name="skill_id"
                required
                className="px-3 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#64748B] text-sm focus:outline-none focus:border-[#4F8AFF] transition-colors"
              >
                <option value="">— Skill requerido —</option>
                {skills.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                name="ticket_category"
                className="px-3 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#64748B] text-sm focus:outline-none focus:border-[#4F8AFF] transition-colors"
              >
                <option value="">Cualquier categoría</option>
                <option value="support">Soporte</option>
                <option value="development">Desarrollo</option>
                <option value="billing">Facturación</option>
                <option value="onboarding">Onboarding</option>
                <option value="other">Otro</option>
              </select>
              <div className="flex items-center gap-2">
                <select
                  name="ticket_priority"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#64748B] text-sm focus:outline-none focus:border-[#4F8AFF] transition-colors"
                >
                  <option value="">Cualquier prioridad</option>
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4F8AFF] hover:bg-[#3D7AEE] text-white text-xs font-medium transition-colors shrink-0"
                >
                  <Plus size={12} /> Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
