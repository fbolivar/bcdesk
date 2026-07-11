import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Server, Monitor, Wifi, Package } from 'lucide-react'

type AssetType = 'hardware' | 'software' | 'network' | 'service' | 'other'
type AssetStatus = 'active' | 'inactive' | 'maintenance' | 'retired'

interface Asset {
  id: string
  name: string
  asset_tag: string | null
  asset_type: AssetType
  status: AssetStatus
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  purchase_date: string | null
  warranty_expiry: string | null
  location: string | null
  notes: string | null
  organization_id: string
  created_at: string
}

const typeConfig: Record<AssetType, { label: string; color: string; Icon: React.ElementType }> = {
  hardware:  { label: 'Hardware',  color: '#00D4AA',  Icon: Server },
  software:  { label: 'Software',  color: '#8B6FFF',  Icon: Package },
  network:   { label: 'Red',       color: '#00D4AA',  Icon: Wifi },
  service:   { label: 'Servicio',  color: '#FFB547',  Icon: Package },
  other:     { label: 'Otro',      color: '#5B6B7C',  Icon: Monitor },
}

const statusConfig: Record<string, { label: string; color: string }> = {
  active:      { label: 'Activo',         color: '#10D98A' },
  inactive:    { label: 'Inactivo',       color: '#FF4D6A' },
  maintenance: { label: 'Mantenimiento',  color: '#FFB547' },
  retired:     { label: 'Retirado',       color: '#94A3B8' },
}

export default async function ClientAssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/client/dashboard')

  const { data: assets } = await supabase
    .from('assets')
    .select('id, name, asset_tag, asset_type, status, manufacturer, model, serial_number, purchase_date, warranty_expiry, location, notes, organization_id, created_at')
    .eq('organization_id', profile.organization_id)
    .order('name')

  const list: Asset[] = assets ?? []

  const byType = Object.keys(typeConfig).reduce((acc, t) => {
    acc[t] = list.filter(a => a.asset_type === t)
    return acc
  }, {} as Record<string, Asset[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#0B2545' }}>Mis activos</h1>
          <p className="text-sm mt-0.5" style={{ color: '#5B6B7C' }}>
            {list.length} activo{list.length !== 1 ? 's' : ''} registrado{list.length !== 1 ? 's' : ''}
          </p>
        </div>
        {/* Resumen por tipo */}
        {list.length > 0 && (
          <div className="flex gap-2 flex-wrap justify-end">
            {Object.entries(typeConfig).map(([key, cfg]) => {
              const count = byType[key]?.length ?? 0
              if (count === 0) return null
              return (
                <span key={key} className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}>
                  {count} {cfg.label}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl p-16 flex flex-col items-center justify-center text-center"
          style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
          <Server size={44} style={{ color: '#5B6B7C' }} className="mb-4" />
          <p className="font-medium" style={{ color: '#0B2545' }}>No hay activos registrados</p>
          <p className="text-sm mt-1" style={{ color: '#5B6B7C' }}>Los equipos y recursos de tu organización aparecerán aquí</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(asset => {
            const typeCfg = typeConfig[asset.asset_type] ?? typeConfig.other
            const statusCfg = statusConfig[asset.status] ?? statusConfig.inactive
            const Icon = typeCfg.Icon
            const warrantyExpiry = asset.warranty_expiry ? new Date(asset.warranty_expiry) : null
            const warrantyExpired = warrantyExpiry ? warrantyExpiry < new Date() : false

            return (
              <div key={asset.id} className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${typeCfg.color}18` }}>
                      <Icon size={17} style={{ color: typeCfg.color }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: typeCfg.color }}>
                      {typeCfg.label}
                    </span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ color: statusCfg.color, background: `${statusCfg.color}18` }}>
                    {statusCfg.label}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-semibold leading-snug" style={{ color: '#0B2545' }}>{asset.name}</h3>
                  {(asset.manufacturer || asset.model) && (
                    <p className="text-xs mt-0.5" style={{ color: '#5B6B7C' }}>
                      {[asset.manufacturer, asset.model].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 mt-auto pt-3"
                  style={{ borderTop: '1px solid #E6EBF2' }}>
                  {asset.asset_tag && (
                    <p className="text-xs" style={{ color: '#5B6B7C' }}>
                      TAG: <span className="font-mono" style={{ color: '#0B2545' }}>{asset.asset_tag}</span>
                    </p>
                  )}
                  {asset.serial_number && (
                    <p className="text-xs" style={{ color: '#5B6B7C' }}>
                      S/N: <span className="font-mono" style={{ color: '#0B2545' }}>{asset.serial_number}</span>
                    </p>
                  )}
                  {asset.location && (
                    <p className="text-xs truncate" style={{ color: '#5B6B7C' }}>
                      📍 {asset.location}
                    </p>
                  )}
                  {warrantyExpiry && (
                    <p className="text-xs" style={{ color: warrantyExpired ? '#FF4D6A' : '#5B6B7C' }}>
                      Garantía: {warrantyExpiry.toLocaleDateString('es-CO')}
                      {warrantyExpired && ' · Vencida'}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
