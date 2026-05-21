import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { GitPullRequest, Plus, Calendar } from 'lucide-react'
import { createChange } from '@/features/admin/services/changes.service'

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-[#334155] text-[#94A3B8]',
  submitted: 'bg-[#3B82F6]/20 text-[#3B82F6]',
  approved: 'bg-[#10B981]/20 text-[#10B981]',
  rejected: 'bg-[#EF4444]/20 text-[#EF4444]',
  in_progress: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  done: 'bg-[#6366F1]/20 text-[#6366F1]',
  cancelled: 'bg-[#334155] text-[#64748B]',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', submitted: 'Enviado', approved: 'Aprobado', rejected: 'Rechazado',
  in_progress: 'En progreso', done: 'Completado', cancelled: 'Cancelado',
}
const TYPE_COLOR: Record<string, string> = {
  standard: 'bg-[#6366F1]/20 text-[#6366F1]',
  normal: 'bg-[#3B82F6]/20 text-[#3B82F6]',
  emergency: 'bg-[#EF4444]/20 text-[#EF4444]',
}
const RISK_COLOR: Record<string, string> = {
  low: 'text-[#10B981]', medium: 'text-[#F59E0B]', high: 'text-[#EF4444]', critical: 'text-[#DC2626]',
}

export default async function ChangesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin','agent'].includes(profile.role)) redirect('/dashboard')

  const { data: changes } = await supabase
    .from('changes')
    .select('*')
    .order('created_at', { ascending: false })

  const list = changes ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#F1F5F9]">Gestión de cambios</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">RFC — Solicitudes de cambio con aprobación CAB</p>
        </div>
      </div>

      {/* Create RFC */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4">Nueva RFC</h2>
        <form action={createChange} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-[#94A3B8] mb-1">Título *</label>
            <input name="title" required placeholder="ej: Actualización del servidor de base de datos"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Tipo</label>
            <select name="change_type"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="standard">Estándar</option>
              <option value="normal">Normal</option>
              <option value="emergency">Emergencia</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Riesgo</label>
            <select name="risk_level"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="low">Bajo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
              <option value="critical">Crítico</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Inicio planificado</label>
            <input name="planned_start" type="datetime-local"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Fin planificado</label>
            <input name="planned_end" type="datetime-local"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#94A3B8] mb-1">Descripción / Justificación</label>
            <textarea name="description" rows={2} placeholder="Describe el cambio y por qué es necesario..."
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569] resize-none" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#94A3B8] mb-1">Plan de rollback</label>
            <textarea name="rollback_plan" rows={2} placeholder="¿Cómo revertir si algo falla?"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569] resize-none" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Crear RFC
            </button>
          </div>
        </form>
      </div>

      {/* Changes list */}
      {list.length > 0 ? (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                {['RFC', 'Tipo', 'Estado', 'Riesgo', 'Planificado', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((c: any) => (
                <tr key={c.id} className="border-b border-[#334155]/50 hover:bg-[#263248]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#F1F5F9]">{c.title}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[c.change_type]}`}>
                      {c.change_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium ${RISK_COLOR[c.risk_level]}`}>
                    {c.risk_level}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">
                    {c.planned_start ? (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(c.planned_start).toLocaleDateString('es-CO')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/changes/${c.id}`}
                      className="px-3 py-1 rounded-lg bg-[#334155] hover:bg-[#475569] text-[#F1F5F9] text-xs transition-colors">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-12 text-center">
          <GitPullRequest size={32} className="text-[#334155] mx-auto mb-3" />
          <p className="text-[#64748B] text-sm">Sin cambios registrados.</p>
        </div>
      )}
    </div>
  )
}
