import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileSignature, AlertTriangle } from 'lucide-react'

type ContractStatus = 'active' | 'expired' | 'draft'
type ContractType = 'SLA' | 'Soporte' | 'Desarrollo' | 'Mantenimiento'

interface Contract {
  id: string
  title: string
  type: ContractType
  start_date: string | null
  end_date: string | null
  status: ContractStatus
  organization_id: string
  created_at: string
}

function getDaysUntilExpiry(endDate: string | null): number | null {
  if (!endDate) return null
  const diff = new Date(endDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function statusLabel(status: ContractStatus) {
  if (status === 'active') return { text: 'Activo', color: '#10D98A', bg: 'rgba(16,217,138,0.12)' }
  if (status === 'expired') return { text: 'Vencido', color: '#FF4D6A', bg: 'rgba(255,77,106,0.12)' }
  return { text: 'Borrador', color: '#8B9BB4', bg: 'rgba(139,155,180,0.12)' }
}

function typeColor(type: ContractType) {
  if (type === 'SLA') return '#4F8AFF'
  if (type === 'Soporte') return '#8B6FFF'
  if (type === 'Desarrollo') return '#10D98A'
  return '#FFB547'
}

export default async function ClientContractsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/client/dashboard')

  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  const list: Contract[] = error ? [] : (contracts ?? [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#F0F4FF]">Contratos</h1>
        <p className="text-sm text-[#8B9BB4] mt-0.5">{list.length} contrato{list.length !== 1 ? 's' : ''}</p>
      </div>

      {list.length === 0 ? (
        <div
          className="rounded-2xl p-16 flex flex-col items-center justify-center text-center"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <FileSignature size={44} className="text-[#8B9BB4] mb-4" />
          <p className="text-[#F0F4FF] font-medium">No tienes contratos activos</p>
          <p className="text-sm text-[#8B9BB4] mt-1">Cuando se agreguen contratos a tu organización aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(contract => {
            const daysLeft = getDaysUntilExpiry(contract.end_date)
            const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30
            const badge = statusLabel(contract.status)

            return (
              <div
                key={contract.id}
                className="rounded-2xl p-5"
                style={{
                  background: expiringSoon
                    ? 'rgba(255,181,71,0.06)'
                    : 'rgba(255,255,255,0.025)',
                  border: expiringSoon
                    ? '1px solid rgba(255,181,71,0.3)'
                    : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-[#F0F4FF] truncate">{contract.title}</h3>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                        style={{ color: typeColor(contract.type), background: `${typeColor(contract.type)}1a` }}
                      >
                        {contract.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {contract.start_date && (
                        <span className="text-xs text-[#8B9BB4]">
                          Inicio: {new Date(contract.start_date).toLocaleDateString('es-CO')}
                        </span>
                      )}
                      {contract.end_date && (
                        <span className="text-xs text-[#8B9BB4]">
                          Fin: {new Date(contract.end_date).toLocaleDateString('es-CO')}
                        </span>
                      )}
                    </div>

                    {expiringSoon && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <AlertTriangle size={13} className="text-[#FFB547]" />
                        <span className="text-xs font-medium text-[#FFB547]">
                          Vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
                    style={{ color: badge.color, background: badge.bg }}
                  >
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
