import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { Siren, Plus, AlertTriangle } from 'lucide-react'

const SEVERITY_COLOR: Record<string, string> = {
  p1: 'bg-[#EF4444] text-white',
  p2: 'bg-[#F59E0B] text-white',
  p3: 'bg-[#3B82F6] text-white',
}
const STATUS_COLOR: Record<string, string> = {
  investigating: 'bg-[#EF4444]/20 text-[#EF4444]',
  identified: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  monitoring: 'bg-[#3B82F6]/20 text-[#3B82F6]',
  resolved: 'bg-[#10B981]/20 text-[#10B981]',
}

export default async function MajorIncidentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) redirect('/dashboard')

  const { data: incidents } = await supabase
    .from('major_incidents')
    .select('*, major_incident_updates(count), major_incident_tickets(count)')
    .order('created_at', { ascending: false })

  const list = incidents ?? []
  const active = list.filter(i => i.status !== 'resolved')

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('major_incidents').insert({
      title: formData.get('title') as string,
      description: formData.get('description') as string || null,
      severity: formData.get('severity') as string || 'p2',
      status: 'investigating',
      incident_commander_id: user?.id,
      affected_services: formData.get('affected_services') as string || null,
    })
    revalidatePath('/admin/major-incidents')
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Gestión de Incidentes Mayores (MIM)</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">War room, comunicación masiva y timeline de incidentes críticos</p>
      </div>

      {/* Active alert */}
      {active.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl">
          <Siren size={14} className="text-[#EF4444] shrink-0 animate-pulse" />
          <p className="text-sm text-[#EF4444] font-medium">
            {active.length} incidente(s) activo(s): {active.map(i => i.title).join(', ')}
          </p>
        </div>
      )}

      {/* Create */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4">Declarar incidente mayor</h2>
        <form action={handleCreate} className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-[#94A3B8] mb-1">Título *</label>
            <input name="title" required placeholder="ej: Caída total del servicio de base de datos"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#EF4444] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Severidad</label>
            <select name="severity" defaultValue="p2"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="p1">P1 — Crítico</option>
              <option value="p2">P2 — Alto</option>
              <option value="p3">P3 — Medio</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#94A3B8] mb-1">Descripción</label>
            <input name="description" placeholder="Descripción del impacto"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Servicios afectados</label>
            <input name="affected_services" placeholder="ej: API, Portal, Chat"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div className="col-span-3 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-medium transition-colors">
              <AlertTriangle size={14} /> Declarar incidente
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {list.length > 0 ? (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                {['Incidente', 'Severidad', 'Estado', 'Servicios', 'Updates', 'Tickets', 'Declarado', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((inc: any) => (
                <tr key={inc.id} className={`border-b border-[#334155]/50 hover:bg-[#263248] ${inc.status !== 'resolved' ? 'bg-[#EF4444]/5' : ''}`}>
                  <td className="px-4 py-3 font-medium text-[#F1F5F9] max-w-[200px]">
                    <p className="truncate">{inc.title}</p>
                    {inc.description && <p className="text-xs text-[#64748B] truncate">{inc.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${SEVERITY_COLOR[inc.severity]}`}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[inc.status]}`}>
                      {inc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{inc.affected_services ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{inc.major_incident_updates?.[0]?.count ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{inc.major_incident_tickets?.[0]?.count ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">
                    {new Date(inc.created_at).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/major-incidents/${inc.id}`}
                      className="px-3 py-1 rounded-lg bg-[#334155] hover:bg-[#475569] text-[#F1F5F9] text-xs transition-colors">
                      War Room
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-12 text-center">
          <Siren size={32} className="text-[#334155] mx-auto mb-3" />
          <p className="text-[#64748B] text-sm">Sin incidentes mayores. ¡Todo tranquilo!</p>
        </div>
      )}
    </div>
  )
}
