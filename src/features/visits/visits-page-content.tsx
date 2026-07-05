import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { MapPin, Plus, ClipboardList } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createVisit } from './visit.service'
import { VISIT_TYPES, VISIT_STATUS, visitTypeMeta, visitStatusColor, visitStatusLabel } from './labels'

const input = 'w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#CBD5E1]'
const lbl = 'block text-xs text-[#64748B] mb-1'

export async function VisitsPageContent({ basePath }: { basePath: string }) {
  const supabase = await createClient()

  const [{ data: visits }, { data: orgs }, { data: agents }] = await Promise.all([
    supabase.from('technical_visits')
      .select('*, organizations(name), technician:profiles!technician_id(full_name)')
      .order('created_at', { ascending: false }),
    supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'agent']).eq('is_active', true).order('full_name'),
  ])

  const list = visits ?? []
  const counts = {
    scheduled: list.filter(v => v.status === 'scheduled').length,
    in_progress: list.filter(v => v.status === 'in_progress').length,
    completed: list.filter(v => v.status === 'completed').length,
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B] flex items-center gap-2">📋 Visitas técnicas</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Registra y deja evidencia de cada visita a sitio del cliente</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '📅 Programadas', n: counts.scheduled, c: '#3B82F6' },
          { label: '🚗 En sitio', n: counts.in_progress, c: '#F59E0B' },
          { label: '✅ Completadas', n: counts.completed, c: '#10B981' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[#E6EBF2] rounded-xl p-4">
            <div className="text-2xl font-bold" style={{ color: s.c }}>{s.n}</div>
            <div className="text-xs text-[#64748B] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Nueva visita */}
      <details className="bg-white border border-[#E6EBF2] rounded-xl">
        <summary className="px-5 py-4 cursor-pointer text-sm font-medium text-[#64748B] hover:text-[#1E293B] select-none flex items-center gap-2">
          <Plus size={15} className="text-[#3B82F6]" /> Registrar nueva visita
        </summary>
        <form action={createVisit} className="px-5 pb-5 pt-2 grid grid-cols-3 gap-3 border-t border-[#E6EBF2]">
          <input type="hidden" name="base_path" value={basePath} />
          <div className="col-span-2">
            <label className={lbl}>Título / motivo *</label>
            <input name="title" required placeholder="ej: Mantenimiento preventivo de servidores" className={input} />
          </div>
          <div>
            <label className={lbl}>Tipo *</label>
            <select name="visit_type" defaultValue="support" className={input}>
              {VISIT_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Cliente *</label>
            <select name="organization_id" required defaultValue="" className={input}>
              <option value="" disabled>Selecciona…</option>
              {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Técnico</label>
            <select name="technician_id" defaultValue="" className={input}>
              <option value="">Yo</option>
              {(agents ?? []).map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Fecha programada</label>
            <input name="scheduled_at" type="datetime-local" className={input} />
          </div>
          <div>
            <label className={lbl}>Sitio / dirección</label>
            <input name="location" placeholder="ej: Sede norte, Cra 1 #2-3" className={input} />
          </div>
          <div>
            <label className={lbl}>Contacto en sitio</label>
            <input name="contact_name" placeholder="Quién recibe" className={input} />
          </div>
          <div className="col-span-3 flex justify-end">
            <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Registrar visita
            </button>
          </div>
        </form>
      </details>

      {/* Lista */}
      {list.length > 0 ? (
        <div className="bg-white border border-[#E6EBF2] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['#', 'Visita', 'Cliente', 'Tipo', 'Técnico', 'Estado', 'Fecha', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((v: Record<string, unknown>) => {
                const org = v.organizations as { name: string } | null
                const tech = v.technician as { full_name: string } | null
                const tm = visitTypeMeta(v.visit_type as string)
                return (
                  <tr key={v.id as string} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                    <td className="px-4 py-3 text-xs font-mono text-[#64748B]">{v.visit_number as string}</td>
                    <td className="px-4 py-3">
                      <Link href={`${basePath}/visits/${v.id}`} className="font-medium text-[#1E293B] hover:text-[#3B82F6]">{v.title as string}</Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">{org?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      <span style={{ color: tm?.color }}>{tm?.emoji} {tm?.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">{tech?.full_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: `${visitStatusColor(v.status as string)}20`, color: visitStatusColor(v.status as string) }}>
                        {visitStatusLabel(v.status as string)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">
                      {v.scheduled_at ? format(new Date(v.scheduled_at as string), 'dd MMM yyyy', { locale: es }) : format(new Date(v.created_at as string), 'dd MMM yyyy', { locale: es })}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`${basePath}/visits/${v.id}`} className="text-xs text-[#3B82F6] hover:underline">Ver →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-[#E6EBF2] rounded-xl p-12 text-center">
          <ClipboardList size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#64748B] text-sm">Sin visitas registradas. Registra la primera arriba.</p>
        </div>
      )}
      <p className="text-[11px] text-[#CBD5E1] flex items-center gap-1"><MapPin size={11} /> Cada visita guarda evidencia (trabajo realizado, hallazgos, fotos y firma del cliente).</p>
    </div>
  )
}
