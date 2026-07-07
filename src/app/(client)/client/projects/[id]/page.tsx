import { fmtDateOnly } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/format/currency'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, DollarSign, Layers } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Project, ProjectPhase } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

interface Props {
  params: Promise<{ id: string }>
}

const phaseStatusColors: Record<string, string> = {
  pending:     '#5B6B7C',
  in_progress: '#1789FC',
  completed:   '#10D98A',
  blocked:     '#FF4D6A',
}

const phaseStatusLabels: Record<string, string> = {
  pending:     'Pendiente',
  in_progress: 'En progreso',
  completed:   'Completado',
  blocked:     'Bloqueado',
}

const projectStatusConfig: Record<string, { label: string; color: string }> = {
  planning:  { label: 'Planificación', color: '#1789FC' },
  active:    { label: 'Activo',        color: '#10D98A' },
  on_hold:   { label: 'En espera',     color: '#FFB547' },
  completed: { label: 'Completado',    color: '#5B6B7C' },
  cancelled: { label: 'Cancelado',     color: '#FF4D6A' },
}

export default async function ClientProjectDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('organization_id').eq('id', user.id).single()

  if (!profile?.organization_id) redirect('/client/dashboard')

  const { data: project } = await supabase
    .from('projects')
    .select('*, organizations(name), project_phases(*)')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!project) notFound()

  const p = project as Project & { organizations?: { name: string }; project_phases: ProjectPhase[] }

  const { data: commentsData } = await supabase
    .from('project_comments')
    .select('*, profiles!author_id(full_name)')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  const comments = commentsData ?? []
  const hasCommentTable = commentsData !== null

  const statusCfg = projectStatusConfig[p.status] ?? { label: p.status, color: '#5B6B7C' }

  const phases = (p.project_phases ?? []).sort((a, b) => a.order_index - b.order_index)

  async function addComment(formData: FormData) {
    'use server'
    const content = formData.get('content') as string
    if (!content?.trim()) return
    const sb = await createClient()
    const { data: { user: u } } = await sb.auth.getUser()
    if (!u) return
    await sb.from('project_comments').insert({
      project_id: id,
      author_id: u.id,
      content: content.trim(),
    })
    revalidatePath(`/client/projects/${id}`)
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/client/projects"
          className="inline-flex items-center gap-2 text-sm mb-4 transition-colors"
          style={{ color: '#5B6B7C' }}
        >
          <ArrowLeft size={14} />
          Volver a proyectos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#0B2545' }}>{p.name}</h1>
            {p.description && (
              <p className="text-sm mt-1" style={{ color: '#5B6B7C' }}>{p.description}</p>
            )}
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: `${statusCfg.color}1a`, color: statusCfg.color }}
          >
            {statusCfg.label}
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {p.start_date && (
          <div
            className="rounded-2xl p-5 flex items-start gap-3"
            style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
          >
            <CalendarDays size={16} style={{ color: '#1789FC', marginTop: 2 }} />
            <div>
              <p className="text-xs mb-0.5" style={{ color: '#5B6B7C' }}>Inicio</p>
              <p className="text-sm font-medium" style={{ color: '#0B2545' }}>
                {fmtDateOnly(p.start_date)}
              </p>
            </div>
          </div>
        )}
        {p.end_date && (
          <div
            className="rounded-2xl p-5 flex items-start gap-3"
            style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
          >
            <CalendarDays size={16} style={{ color: '#FFB547', marginTop: 2 }} />
            <div>
              <p className="text-xs mb-0.5" style={{ color: '#5B6B7C' }}>Fin estimado</p>
              <p className="text-sm font-medium" style={{ color: '#0B2545' }}>
                {fmtDateOnly(p.end_date)}
              </p>
            </div>
          </div>
        )}
        {p.budget_usd != null && (
          <div
            className="rounded-2xl p-5 flex items-start gap-3"
            style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
          >
            <DollarSign size={16} style={{ color: '#10D98A', marginTop: 2 }} />
            <div>
              <p className="text-xs mb-0.5" style={{ color: '#5B6B7C' }}>Presupuesto</p>
              <p className="text-sm font-medium" style={{ color: '#0B2545' }}>
                {formatMoney(p.budget_usd, p.currency)}
              </p>
            </div>
          </div>
        )}
        <div
          className="rounded-2xl p-5"
          style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
        >
          <p className="text-xs mb-2" style={{ color: '#5B6B7C' }}>Progreso general</p>
          <p className="text-xl font-bold mb-2" style={{ color: '#1789FC' }}>{p.progress_percent}%</p>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E6EBF2' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${p.progress_percent}%`, background: '#1789FC' }}
            />
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid #E6EBF2' }}>
          <Layers size={15} style={{ color: '#1789FC' }} />
          <h2 className="text-sm font-semibold" style={{ color: '#0B2545' }}>
            Fases del proyecto <span style={{ color: '#5B6B7C', fontWeight: 400 }}>({phases.length})</span>
          </h2>
        </div>
        {phases.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm" style={{ color: '#5B6B7C' }}>No hay fases definidas aún.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #E6EBF2' }}>
                {['Fase', 'Estado', 'Fecha inicio', 'Fecha fin'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: '#5B6B7C' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {phases.map((phase, idx) => {
                const color = phaseStatusColors[phase.status] ?? '#5B6B7C'
                const label = phaseStatusLabels[phase.status] ?? phase.status
                return (
                  <tr
                    key={phase.id}
                    style={{ borderBottom: idx < phases.length - 1 ? '1px solid #F4F7FB' : 'none' }}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium" style={{ color: '#0B2545' }}>{phase.name}</p>
                      {phase.description && (
                        <p className="text-xs mt-0.5" style={{ color: '#5B6B7C' }}>{phase.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: `${color}1a`, color }}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: '#5B6B7C' }}>
                      {phase.start_date
                        ? fmtDateOnly(phase.start_date)
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: '#5B6B7C' }}>
                      {phase.end_date
                        ? fmtDateOnly(phase.end_date)
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>

      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: '#0B2545' }}>
          Actividad <span style={{ color: '#5B6B7C', fontWeight: 400 }}>({comments.length})</span>
        </h2>

        {comments.length === 0 ? (
          <div
            className="rounded-xl px-5 py-8 text-center"
            style={{ background: '#FFFFFF', border: '1px dashed #E6EBF2' }}
          >
            <p className="text-sm" style={{ color: '#5B6B7C' }}>
              Sin actividad registrada. Sé el primero en comentar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((c: { id: string; content: string; created_at: string; profiles?: { full_name: string } }) => (
              <div
                key={c.id}
                className="flex gap-3"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'rgba(23,137,252,0.15)', color: '#1789FC' }}
                >
                  {c.profiles?.full_name?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium" style={{ color: '#0B2545' }}>{c.profiles?.full_name}</span>
                    <span className="text-[10px]" style={{ color: '#5B6B7C' }}>
                      {format(new Date(c.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
                    </span>
                  </div>
                  <div
                    className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                    style={{ background: '#FFFFFF', border: '1px solid #E6EBF2', color: '#0B2545' }}
                  >
                    {c.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasCommentTable && (
          <form action={addComment} className="flex gap-3 pt-2">
            <textarea
              name="content"
              rows={3}
              placeholder="Escribe un comentario o actualización..."
              className="flex-1 px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none transition-colors"
              style={{
                background: '#F4F7FB',
                border: '1px solid #E6EBF2',
                color: '#0B2545',
              }}
            />
            <button
              type="submit"
              className="self-end px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: '#1789FC', color: '#fff' }}
            >
              Enviar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
