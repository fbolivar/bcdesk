import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Activity, Plus } from 'lucide-react'

export default async function SoftwareMeteringPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) redirect('/dashboard')

  const [licensesRes, usersRes, orgsRes] = await Promise.all([
    supabase.from('software_licenses').select('id, software_name, vendor, seats_total, seats_used').eq('is_active', true).order('software_name'),
    supabase.from('profiles').select('id, full_name, email').order('full_name'),
    supabase.from('organizations').select('id, name').eq('is_active', true),
  ])

  const licenses = licensesRes.data ?? []

  // Usage stats per license (last 30 days)
  const { data: usageStats } = await supabase
    .from('software_usage_logs')
    .select('license_id, user_id, duration_minutes, usage_date')
    .gte('usage_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])

  const usageByLicense: Record<string, { totalMinutes: number; uniqueUsers: Set<string> }> = {}
  for (const u of usageStats ?? []) {
    if (!usageByLicense[u.license_id]) usageByLicense[u.license_id] = { totalMinutes: 0, uniqueUsers: new Set() }
    usageByLicense[u.license_id].totalMinutes += u.duration_minutes ?? 0
    usageByLicense[u.license_id].uniqueUsers.add(u.user_id)
  }

  async function handleLog(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('software_usage_logs').insert({
      license_id: formData.get('license_id') as string,
      user_id: formData.get('user_id') as string,
      organization_id: formData.get('organization_id') as string || null,
      usage_date: formData.get('usage_date') as string || new Date().toISOString().split('T')[0],
      duration_minutes: parseInt(formData.get('duration_minutes') as string) || 0,
      reported_by: user?.id,
    })
    revalidatePath('/admin/licenses/metering')
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Software metering</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">Registro manual de uso de software vs licencias compradas (últimos 30 días)</p>
      </div>

      {/* Log usage */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4">Registrar uso</h2>
        <form action={handleLog} className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Licencia *</label>
            <select name="license_id" required defaultValue=""
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="" disabled>Selecciona...</option>
              {licenses.map(l => <option key={l.id} value={l.id}>{l.software_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Usuario *</label>
            <select name="user_id" required defaultValue=""
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="" disabled>Selecciona...</option>
              {(usersRes.data ?? []).map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Fecha</label>
            <input name="usage_date" type="date" defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Duración (minutos)</label>
            <input name="duration_minutes" type="number" placeholder="60"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Organización</label>
            <select name="organization_id" defaultValue=""
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="">Global</option>
              {(orgsRes.data ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Registrar uso
            </button>
          </div>
        </form>
      </div>

      {/* Usage summary per license */}
      {licenses.length > 0 && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#334155] flex items-center gap-2">
            <Activity size={14} className="text-[#64748B]" />
            <span className="text-xs font-semibold text-[#64748B]">USO VS LICENCIAS — ÚLTIMOS 30 DÍAS</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                {['Software', 'Asientos', 'Usuarios activos', 'Horas de uso', 'Utilización', 'Estado'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {licenses.map((l: any) => {
                const usage = usageByLicense[l.id]
                const activeUsers = usage?.uniqueUsers.size ?? 0
                const hours = ((usage?.totalMinutes ?? 0) / 60).toFixed(1)
                const utilPct = l.seats_total > 0 ? Math.round((activeUsers / l.seats_total) * 100) : 0
                const isUnused = activeUsers === 0
                const isOverused = activeUsers > l.seats_total
                return (
                  <tr key={l.id} className="border-b border-[#334155]/50 hover:bg-[#263248]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#F1F5F9]">{l.software_name}</p>
                      {l.vendor && <p className="text-xs text-[#64748B]">{l.vendor}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{l.seats_used}/{l.seats_total}</td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{activeUsers}</td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{hours}h</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 bg-[#334155] rounded-full w-16">
                          <div className={`h-full rounded-full ${isOverused ? 'bg-[#EF4444]' : utilPct > 70 ? 'bg-[#F59E0B]' : 'bg-[#10B981]'}`}
                            style={{ width: `${Math.min(utilPct, 100)}%` }} />
                        </div>
                        <span className="text-xs text-[#94A3B8]">{utilPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        isOverused ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                        isUnused ? 'bg-[#334155] text-[#64748B]' :
                        'bg-[#10B981]/20 text-[#10B981]'
                      }`}>
                        {isOverused ? 'Excedido' : isUnused ? 'Sin uso' : 'Normal'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
