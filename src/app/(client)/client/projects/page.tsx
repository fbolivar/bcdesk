import { fmtDateOnly } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/format/currency'
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
    planning:  { label: 'Planificación', color: 'bg-[#00D4AA]/20 text-[#0E9E86]' },
    active:    { label: 'Activo',        color: 'bg-[#10B981]/20 text-[#10B981]' },
    on_hold:   { label: 'En espera',     color: 'bg-[#F59E0B]/20 text-[#F59E0B]' },
    completed: { label: 'Completado',    color: 'bg-[#5B6B7C]/20 text-[#5B6B7C]' },
    cancelled: { label: 'Cancelado',     color: 'bg-[#E6EBF2] text-[#5B6B7C]' },
  }

  const phaseStatusConfig = {
    pending:     { label: 'Pendiente',    color: 'bg-[#E6EBF2] text-[#5B6B7C]' },
    in_progress: { label: 'En progreso',  color: 'bg-[#00D4AA]/20 text-[#0E9E86]' },
    completed:   { label: 'Completado',   color: 'bg-[#10B981]/20 text-[#10B981]' },
    blocked:     { label: 'Bloqueado',    color: 'bg-[#EF4444]/20 text-[#EF4444]' },
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Proyectos</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">{typedProjects.length} proyectos en total</p>
      </div>

      {typedProjects.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <p className="text-[#5B6B7C]">No hay proyectos asignados todavía.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {typedProjects.map(project => {
            const cfg = statusConfig[project.status]
            return (
              <Link key={project.id} href={`/client/projects/${project.id}`} className="block">
              <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 hover:border-[#00D4AA]/40 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-[#0B2545]">{project.name}</h2>
                    {project.description && (
                      <p className="text-sm text-[#5B6B7C] mt-1">{project.description}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${cfg.color}`}>{cfg.label}</span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs text-[#5B6B7C] mb-1.5">
                    <span>Progreso general</span>
                    <span className="font-medium">{project.progress_percent}%</span>
                  </div>
                  <div className="h-2 bg-[#E6EBF2] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00D4AA] rounded-full transition-all"
                      style={{ width: `${project.progress_percent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                  {project.start_date && (
                    <div>
                      <p className="text-xs text-[#5B6B7C] mb-0.5">Inicio</p>
                      <p className="text-[#5B6B7C]">{fmtDateOnly(project.start_date)}</p>
                    </div>
                  )}
                  {project.end_date && (
                    <div>
                      <p className="text-xs text-[#5B6B7C] mb-0.5">Fin estimado</p>
                      <p className="text-[#5B6B7C]">{fmtDateOnly(project.end_date)}</p>
                    </div>
                  )}
                  {project.budget_usd && (
                    <div>
                      <p className="text-xs text-[#5B6B7C] mb-0.5">Presupuesto</p>
                      <p className="text-[#5B6B7C]">{formatMoney(project.budget_usd, project.currency)}</p>
                    </div>
                  )}
                </div>

                {project.project_phases?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-[#5B6B7C] mb-2">Fases del proyecto</p>
                    <div className="space-y-2">
                      {project.project_phases
                        .sort((a, b) => a.order_index - b.order_index)
                        .map(phase => {
                          const pCfg = phaseStatusConfig[phase.status]
                          return (
                            <div key={phase.id} className="flex items-center gap-3 py-2 border-t border-[#E6EBF2]/50">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pCfg.color}`}>{pCfg.label}</span>
                              <span className="text-sm text-[#5B6B7C] flex-1">{phase.name}</span>
                              <span className="text-xs font-mono text-[#5B6B7C]">{phase.progress_percent}%</span>
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
