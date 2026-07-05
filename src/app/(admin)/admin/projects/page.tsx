import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/format/currency'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createProject } from '@/features/admin/services/admin.service'
import type { Project } from '@/lib/supabase/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function AdminProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const [{ data: projects }, { data: orgs }] = await Promise.all([
    supabase.from('projects').select('*, organizations(name)').order('created_at', { ascending: false }),
    supabase.from('organizations').select('id, name').eq('status', 'active'),
  ])

  const typedProjects = (projects ?? []) as (Project & { organizations?: { name: string } })[]

  const statusConfig: Record<string, { label: string; color: string }> = {
    planning:  { label: 'Planificación', color: 'bg-[#3B82F6]/20 text-[#3B82F6]' },
    active:    { label: 'Activo',        color: 'bg-[#10B981]/20 text-[#10B981]' },
    on_hold:   { label: 'En espera',     color: 'bg-[#F59E0B]/20 text-[#F59E0B]' },
    completed: { label: 'Completado',    color: 'bg-[#64748B]/20 text-[#64748B]' },
    cancelled: { label: 'Cancelado',     color: 'bg-[#E6EBF2] text-[#64748B]' },
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Proyectos</h1>
        <p className="text-sm text-[#64748B] mt-0.5">{typedProjects.length} proyectos</p>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E6EBF2]">
              {['Proyecto', 'Cliente', 'Estado', 'Progreso', 'Presupuesto', 'Fin estimado', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typedProjects.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#64748B]">No hay proyectos</td></tr>
            ) : typedProjects.map(p => {
              const cfg = statusConfig[p.status] ?? statusConfig.planning
              return (
                <tr key={p.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/projects/${p.id}`} className="text-sm font-medium text-[#1E293B] hover:text-[#3B82F6]">{p.name}</Link>
                    {p.description && <p className="text-xs text-[#64748B] mt-0.5 line-clamp-1">{p.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{p.organizations?.name ?? '—'}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span></td>
                  <td className="px-4 py-3 min-w-[100px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#E6EBF2] rounded-full overflow-hidden">
                        <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${p.progress_percent}%` }} />
                      </div>
                      <span className="text-xs text-[#64748B] w-8 text-right">{p.progress_percent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">
                    {p.budget_usd ? formatMoney(p.budget_usd) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">
                    {p.end_date ? format(new Date(p.end_date), 'dd MMM yyyy', { locale: es }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/projects/${p.id}`} className="text-xs text-[#3B82F6] hover:underline">Ver →</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <details className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl">
        <summary className="px-5 py-4 cursor-pointer text-sm font-medium text-[#64748B] hover:text-[#1E293B] select-none">
          + Crear nuevo proyecto
        </summary>
        <form action={createProject} className="px-5 pb-5 space-y-4 border-t border-[#E6EBF2] pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Nombre *</label>
              <input name="name" required className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Cliente *</label>
              <select name="organization_id" required className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors">
                <option value="">Seleccionar...</option>
                {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Presupuesto (USD)</label>
              <input name="budget_usd" type="number" step="0.01" className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Fecha inicio</label>
              <input name="start_date" type="date" className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Fecha fin estimada</label>
              <input name="end_date" type="date" className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Descripción</label>
            <textarea name="description" rows={2} className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors resize-none" />
          </div>
          <button type="submit" className="px-5 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
            Crear proyecto
          </button>
        </form>
      </details>
    </div>
  )
}
