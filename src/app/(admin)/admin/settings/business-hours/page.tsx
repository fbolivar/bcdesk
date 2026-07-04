import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Clock } from 'lucide-react'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default async function BusinessHoursPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: orgs } = await supabase.from('organizations').select('id, name').eq('is_active', true).order('name')
  const { data: hours } = await supabase.from('business_hours').select('*').order('day_of_week')

  const orgList = orgs ?? []
  const hoursList = hours ?? []

  // Group by org + tipo (nombre de plantilla)
  const byGroup: Record<string, typeof hoursList> = {}
  for (const h of hoursList) {
    const key = `${h.organization_id ?? 'global'}|${(h as { name?: string }).name ?? 'Estándar'}`
    if (!byGroup[key]) byGroup[key] = []
    byGroup[key].push(h)
  }

  async function handleSave(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const orgId = formData.get('organization_id') as string || null
    const name = (formData.get('name') as string)?.trim() || 'Estándar'
    const timezone = formData.get('timezone') as string || 'America/Bogota'

    const upserts = DAYS.map((_, i) => ({
      organization_id: orgId,
      name,
      day_of_week: i,
      is_open: formData.get(`day_${i}_open`) === 'on',
      open_time: formData.get(`day_${i}_open_time`) as string || '09:00',
      close_time: formData.get(`day_${i}_close_time`) as string || '18:00',
      timezone,
    }))

    await supabase.from('business_hours').upsert(upserts, { onConflict: 'organization_id,name,day_of_week' })
    revalidatePath('/admin/settings/business-hours')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Horario laboral</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Define las horas hábiles para el cálculo correcto de SLA</p>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <form action={handleSave} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#64748B] mb-1">Tipo de horario</label>
              <input name="name" defaultValue="Estándar" placeholder="ej: Estándar 8x5, 24x7…"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#CBD5E1]" />
            </div>
            <div>
              <label className="block text-xs text-[#64748B] mb-1">Organización (vacío = global)</label>
              <select name="organization_id" defaultValue=""
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6]">
                <option value="">Global (todas las orgs)</option>
                {orgList.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#64748B] mb-1">Zona horaria</label>
              <select name="timezone" defaultValue="America/Bogota"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6]">
                <option value="America/Bogota">América/Bogotá (UTC-5)</option>
                <option value="America/Mexico_City">América/México (UTC-6)</option>
                <option value="America/New_York">América/Nueva York (UTC-5)</option>
                <option value="Europe/Madrid">Europa/Madrid (UTC+1)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {DAYS.map((day, i) => {
              const isWeekend = i === 0 || i === 6
              return (
                <div key={i} className="flex items-center gap-4 px-3 py-2.5 rounded-lg bg-[#F4F7FB]">
                  <label className="flex items-center gap-2 w-32 cursor-pointer">
                    <input type="checkbox" name={`day_${i}_open`} defaultChecked={!isWeekend}
                      className="rounded" />
                    <span className="text-sm text-[#1E293B]">{day}</span>
                  </label>
                  <div className="flex items-center gap-2 flex-1">
                    <input type="time" name={`day_${i}_open_time`} defaultValue="09:00"
                      className="px-2 py-1 bg-[#FFFFFF] border border-[#E6EBF2] rounded text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6]" />
                    <span className="text-xs text-[#64748B]">a</span>
                    <input type="time" name={`day_${i}_close_time`} defaultValue="18:00"
                      className="px-2 py-1 bg-[#FFFFFF] border border-[#E6EBF2] rounded text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6]" />
                  </div>
                  {isWeekend && <span className="text-xs text-[#CBD5E1]">fin de semana</span>}
                </div>
              )
            })}
          </div>

          <div className="flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              <Clock size={14} /> Guardar horario
            </button>
          </div>
        </form>
      </div>

      {Object.keys(byGroup).length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#E6EBF2]">
            <span className="text-xs font-semibold text-[#64748B]">HORARIOS CONFIGURADOS</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Tipo', 'Organización', 'Días hábiles', 'Horario', 'Zona'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byGroup).map(([key, rows]) => {
                const [orgId, name] = key.split('|')
                const org = orgList.find(o => o.id === orgId)
                const openDays = rows.filter(r => r.is_open)
                return (
                  <tr key={key} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                    <td className="px-4 py-3 text-sm font-medium text-[#1E293B]">{name}</td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">{org?.name ?? 'Global'}</td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">
                      {openDays.map(r => DAYS[r.day_of_week].slice(0, 3)).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">
                      {openDays[0] ? `${openDays[0].open_time} – ${openDays[0].close_time}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">{rows[0]?.timezone ?? '—'}</td>
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
