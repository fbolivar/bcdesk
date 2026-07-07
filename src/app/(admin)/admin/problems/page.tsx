import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Plus } from 'lucide-react'
import { createProblem } from '@/features/admin/services/problems.service'

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-[#EF4444]/20 text-[#EF4444]',
  investigating: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  known_error: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
  resolved: 'bg-[#10B981]/20 text-[#10B981]',
  closed: 'bg-[#E6EBF2] text-[#5B6B7C]',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto', investigating: 'Investigando', known_error: 'Error conocido',
  resolved: 'Resuelto', closed: 'Cerrado',
}
const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-[#5B6B7C]', medium: 'text-[#1789FC]', high: 'text-[#F59E0B]', urgent: 'text-[#EF4444]',
}

export default async function ProblemsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin','agent'].includes(profile.role)) redirect('/dashboard')

  const { data: problems } = await supabase
    .from('problems')
    .select('*, profiles!problems_created_by_fkey(full_name), problem_incidents(count)')
    .order('created_at', { ascending: false })

  const list = problems ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">Gestión de problemas</h1>
          <p className="text-sm text-[#5B6B7C] mt-0.5">ITIL — Problemas raíz vinculados a incidentes</p>
        </div>
      </div>

      {/* Create form */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Registrar nuevo problema</h2>
        <form action={createProblem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-[#5B6B7C] mb-1">Título *</label>
            <input name="title" required placeholder="ej: Caída intermitente del servidor de correo"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Prioridad</label>
            <select name="priority" defaultValue="medium"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className="block text-xs text-[#5B6B7C] mb-1">Descripción</label>
            <textarea name="description" rows={2} placeholder="Describe el síntoma y el impacto..."
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1] resize-none" />
          </div>
          <div className="col-span-3 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Crear problema
            </button>
          </div>
        </form>
      </div>

      {/* Problems list */}
      {list.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Problema', 'Estado', 'Prioridad', 'Incidentes', 'Registrado', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p: any) => (
                <tr key={p.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#0B2545]">{p.title}</p>
                    {p.description && <p className="text-xs text-[#5B6B7C] truncate max-w-xs">{p.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium ${PRIORITY_COLOR[p.priority]}`}>
                    {p.priority}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">
                    {p.problem_incidents?.[0]?.count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">
                    {new Date(p.created_at).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/problems/${p.id}`}
                      className="px-3 py-1 rounded-lg bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#0B2545] text-xs transition-colors">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <AlertTriangle size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Sin problemas registrados.</p>
        </div>
      )}
    </div>
  )
}
