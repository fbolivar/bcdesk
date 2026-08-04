import { fmtDateOnly } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileSignature, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  name: string
  contract_type: string | null
  status: string | null
  start_date: string | null
  end_date: string | null
}

const TYPE_LABEL: Record<string, string> = {
  support: 'Soporte', maintenance: 'Mantenimiento', managed: 'Managed Services', project: 'Proyecto',
}
const TYPE_COLOR: Record<string, string> = {
  support: '#8B6FFF', maintenance: '#FFB547', managed: '#00D4AA', project: '#10D98A',
}
const STATUS: Record<string, { text: string; color: string; bg: string }> = {
  active:    { text: 'Activo',    color: '#10B981', bg: 'rgba(16,217,138,0.12)' },
  expired:   { text: 'Vencido',   color: '#EF4444', bg: 'rgba(255,77,106,0.12)' },
  suspended: { text: 'En espera', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  cancelled: { text: 'Cancelado', color: '#5B6B7C', bg: 'rgba(139,155,180,0.12)' },
}

function daysUntil(endDate: string | null): number | null {
  if (!endDate) return null
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default async function ClientContractsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) redirect('/client/dashboard')

  // Tabla real de contratos = service_contracts (RLS permite ver los de tu org).
  const { data: contracts } = await supabase
    .from('service_contracts')
    .select('id, name, contract_type, status, start_date, end_date')
    .eq('organization_id', profile.organization_id)
    .order('end_date', { ascending: true })

  const list = (contracts ?? []) as Row[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Contratos</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">{list.length} contrato{list.length !== 1 ? 's' : ''}</p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl p-16 flex flex-col items-center justify-center text-center" style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <FileSignature size={44} className="text-[#5B6B7C] mb-4" />
          <p className="text-[#0B2545] font-medium">No tienes contratos registrados</p>
          <p className="text-sm text-[#5B6B7C] mt-1">Cuando se agreguen contratos a tu organización aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(c => {
            const daysLeft = daysUntil(c.end_date)
            const expiringSoon = c.status === 'active' && daysLeft !== null && daysLeft >= 0 && daysLeft <= 30
            const badge = STATUS[c.status ?? ''] ?? { text: c.status ?? '—', color: '#5B6B7C', bg: 'rgba(139,155,180,0.12)' }
            const typeLabel = TYPE_LABEL[c.contract_type ?? ''] ?? (c.contract_type ?? 'Servicio')
            const typeColor = TYPE_COLOR[c.contract_type ?? ''] ?? '#8B6FFF'

            return (
              <div key={c.id} className="rounded-2xl p-5" style={{
                background: expiringSoon ? 'rgba(255,181,71,0.06)' : '#FFFFFF',
                border: expiringSoon ? '1px solid rgba(255,181,71,0.3)' : '1px solid #E6EBF2',
              }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-[#0B2545]">{c.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ color: typeColor, background: `${typeColor}1a` }}>
                        {typeLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {c.start_date && <span className="text-xs text-[#5B6B7C]">Inicio: {fmtDateOnly(c.start_date)}</span>}
                      {c.end_date && <span className="text-xs text-[#5B6B7C]">Fin: {fmtDateOnly(c.end_date)}</span>}
                    </div>
                    {expiringSoon && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <AlertTriangle size={13} className="text-[#FFB547]" />
                        <span className="text-xs font-medium text-[#FFB547]">Vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0" style={{ color: badge.color, background: badge.bg }}>
                    {badge.text}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
