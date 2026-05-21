import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Project, ProjectPhase } from '@/lib/supabase/types'

export default async function ClientProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('organization_id').eq('id', user.id).single()

  if (!profile?.organization_id) redirect('/client/dashboard')

  const { data: projects } = await supabase
    .from('projects')
    .select('*, project_phases(*)')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  const typedProjects = (projects ?? []) as (Project & { project_phases: ProjectPhase[] })[]

  const statusConfig = {
    planning:  { label: 'Planificación', color: 'bg-[#3B82F6]/20 text-[#3B82F6]' },
    active:    { label: 'Activo',        color: 'bg-[#10B981]/20 text-[#10B981]' },
    on_hold:   { label: 'En espera',     color: 'bg-[#F59E0B]/20 text-[#F59E0B]' },
    completed: { label: 'Completado',    color: 'bg-[#64748B]/20 text-[#94A3B8]' },
    cancelled: { label: 'Cancelado',     color: 'bg-[#334155] text-[#64748B]' },
  }

  const phaseStatusConfig = {
    pending:     { label: 'Pendiente',    color: 'bg-[#334155] text-[#94A3B8]' },
    in_progress: { label: 'En progreso',  color: 'bg-[#3B82F6]/20 text-[#3B82F6]' },
    completed:   { label: 'Completado',   color: 'bg-[#10B981]/20 text-[#10B981]' },
    blocked:     { label: 'Bloqueado',    color: 'bg-[#EF4444]/20 text-[#EF4444]' },
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Proyectos</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">{typedProjects.length} proyectos en total</p>
      </div>

      {typedProjects.length === 0 ? (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-12 text-center">
          <p className="text-[#64748B]">No hay proyectos asignados todavía.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {typedProjects.map(project => {
            const cfg = statusConfig[project.status]
            return (
              <Link key={project.id} href={`/client/projects/${project.id}`} className="block">
              <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5 hover:border-[#4F8AFF]/40 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-[#F1F5F9]">{project.name}</h2>
                    {project.description && (
                      <p className="text-sm text-[#94A3B8] mt-1">{project.description}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${cfg.color}`}>{cfg.label}</span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs text-[#94A3B8] mb-1.5">
                    <span>Progreso general</span>
                    <span className="font-medium">{project.progress_percent}%</span>
                  </div>
                  <div className="h-2 bg-[#334155] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#3B82F6] rounded-full transition-all"
                      style={{ width: `${project.progress_percent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                  {project.start_date && (
                    <div>
                      <p className="text-xs text-[#64748B] mb-0.5">Inicio</p>
                      <p className="text-[#94A3B8]">{format(new Date(project.start_date), 'dd MMM yyyy', { locale: es })}</p>
                    </div>
                  )}
                  {project.end_date && (
                    <div>
                      <p className="text-xs text-[#64748B] mb-0.5">Fin estimado</p>
                      <p className="text-[#94A3B8]">{format(new Date(project.end_date), 'dd MMM yyyy', { locale: es })}</p>
                    </div>
                  )}
                  {project.budget_usd && (
                    <div>
                      <p className="text-xs text-[#64748B] mb-0.5">Presupuesto</p>
                      <p className="text-[#94A3B8]">${project.budget_usd.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {project.project_phases?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-[#64748B] mb-2">Fases del proyecto</p>
                    <div className="space-y-2">
                      {project.project_phases
                        .sort((a, b) => a.order_index - b.order_index)
                        .map(phase => {
                          const pCfg = phaseStatusConfig[phase.status]
                          return (
                            <div key={phase.id} className="flex items-center gap-3 py-2 border-t border-[#334155]/50">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pCfg.color}`}>{pCfg.label}</span>
                              <span className="text-sm text-[#94A3B8] flex-1">{phase.name}</span>
                              <span className="text-xs font-mono text-[#64748B]">{phase.progress_percent}%</span>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
              </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
