import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { updateProjectProgress } from '@/features/admin/services/admin.service'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Project, ProjectPhase } from '@/lib/supabase/types'
import { KanbanBoard } from '@/features/admin/components/kanban-board'

interface Props { params: Promise<{ id: string }> }

export default async function AdminProjectDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const [projectRes, tasksRes, agentsRes] = await Promise.all([
    supabase.from('projects')
      .select('*, organizations(name), profiles!managed_by(full_name), project_phases(*)')
      .eq('id', id).single(),
    supabase.from('project_tasks')
      .select('*, profiles!assignee_id(full_name)')
      .eq('project_id', id)
      .order('order_index'),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'agent']).eq('is_active', true),
  ])

  if (!projectRes.data) notFound()

  const p = projectRes.data as Project & {
    organizations?: { name: string }
    profiles?: { full_name: string }
    project_phases: ProjectPhase[]
  }

  const phases = (p.project_phases ?? []).sort((a, b) => a.order_index - b.order_index)
  const tasks = tasksRes.data ?? []
  const agents = agentsRes.data ?? []

  const statusConfig: Record<string, { label: string; color: string }> = {
    planning:  { label: 'Planificación', color: 'bg-[#3B82F6]/20 text-[#3B82F6]' },
    active:    { label: 'Activo',        color: 'bg-[#10B981]/20 text-[#10B981]' },
    on_hold:   { label: 'En espera',     color: 'bg-[#F59E0B]/20 text-[#F59E0B]' },
    completed: { label: 'Completado',    color: 'bg-[#64748B]/20 text-[#94A3B8]' },
    cancelled: { label: 'Cancelado',     color: 'bg-[#334155] text-[#64748B]' },
  }

  const phaseStatusConfig: Record<string, { label: string; color: string }> = {
    pending:     { label: 'Pendiente',   color: 'bg-[#334155] text-[#94A3B8]' },
    in_progress: { label: 'En progreso', color: 'bg-[#3B82F6]/20 text-[#3B82F6]' },
    completed:   { label: 'Completado',  color: 'bg-[#10B981]/20 text-[#10B981]' },
    blocked:     { label: 'Bloqueado',   color: 'bg-[#EF4444]/20 text-[#EF4444]' },
  }

  const cfg = statusConfig[p.status] ?? statusConfig.planning

  async function handleUpdateProgress(formData: FormData) {
    'use server'
    const progress = Number(formData.get('progress'))
    await updateProjectProgress(id, progress)
    redirect(`/admin/projects/${id}`)
  }

  async function handleAddPhase(formData: FormData) {
    'use server'
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.from('project_phases').insert({
      project_id: id,
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      order_index: phases.length,
      start_date: formData.get('start_date') as string || null,
      end_date: formData.get('end_date') as string || null,
    })
    redirect(`/admin/projects/${id}`)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/projects" className="inline-flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#F1F5F9]">
        <ArrowLeft size={14} /> Volver a proyectos
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F1F5F9]">{p.name}</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">{p.organizations?.name}</p>
          {p.description && <p className="text-sm text-[#64748B] mt-1">{p.description}</p>}
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Inicio',     value: p.start_date ? format(new Date(p.start_date), 'dd MMM yyyy', { locale: es }) : '—' },
          { label: 'Fin',        value: p.end_date ? format(new Date(p.end_date), 'dd MMM yyyy', { locale: es }) : '—' },
          { label: 'Presupuesto', value: p.budget_usd ? `$${p.budget_usd.toLocaleString()}` : '—' },
          { label: 'Gastado',    value: `$${(p.spent_usd ?? 0).toLocaleString()}` },
        ].map(s => (
          <div key={s.label} className="bg-[#1E293B] border border-[#334155] rounded-xl p-3">
            <p className="text-xs text-[#64748B] mb-0.5">{s.label}</p>
            <p className="text-sm font-medium text-[#F1F5F9]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[#F1F5F9]">Progreso general</h2>
          <span className="text-lg font-bold text-[#3B82F6]">{p.progress_percent}%</span>
        </div>
        <div className="h-3 bg-[#334155] rounded-full overflow-hidden mb-4">
          <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${p.progress_percent}%` }} />
        </div>
        <form action={handleUpdateProgress} className="flex items-center gap-3">
          <input name="progress" type="range" min="0" max="100" defaultValue={p.progress_percent} className="flex-1 accent-[#3B82F6]" />
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-medium transition-colors">
            Actualizar
          </button>
        </form>
      </div>

      {/* Phases */}
      <div>
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-3">Fases ({phases.length})</h2>
        {phases.length === 0 ? (
          <p className="text-sm text-[#64748B]">Sin fases definidas.</p>
        ) : (
          <div className="space-y-2">
            {phases.map((phase, i) => {
              const pCfg = phaseStatusConfig[phase.status]
              return (
                <div key={phase.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-[#64748B] w-5">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#F1F5F9]">{phase.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${pCfg.color}`}>{pCfg.label}</span>
                      </div>
                      {phase.description && <p className="text-xs text-[#64748B] mt-0.5">{phase.description}</p>}
                    </div>
                    <span className="text-xs font-mono text-[#94A3B8]">{phase.progress_percent}%</span>
                  </div>
                  {(phase.start_date || phase.end_date) && (
                    <div className="flex gap-4 mt-2 pl-8">
                      {phase.start_date && <span className="text-[10px] text-[#64748B]">Inicio: {format(new Date(phase.start_date), 'dd MMM', { locale: es })}</span>}
                      {phase.end_date && <span className="text-[10px] text-[#64748B]">Fin: {format(new Date(phase.end_date), 'dd MMM', { locale: es })}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <details className="bg-[#1E293B] border border-[#334155] rounded-xl mt-3">
          <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] select-none">
            + Agregar fase
          </summary>
          <form action={handleAddPhase} className="px-4 pb-4 space-y-3 border-t border-[#334155] pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">Nombre *</label>
                <input name="name" required className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">Fecha inicio</label>
                <input name="start_date" type="date" className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">Fecha fin</label>
                <input name="end_date" type="date" className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
              </div>
            </div>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              Agregar
            </button>
          </form>
        </details>
      </div>
    </div>

      {/* Kanban board */}
      <div>
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-3">Tareas ({tasks.length})</h2>
        <KanbanBoard projectId={id} initialTasks={tasks as any} agents={agents} />
      </div>
    </div>
  )
}
