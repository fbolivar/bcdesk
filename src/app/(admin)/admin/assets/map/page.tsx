import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CmdbVisualMap } from '@/features/admin/components/cmdb-visual-map'
import { Network } from 'lucide-react'
import Link from 'next/link'

export default async function CmdbMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) redirect('/dashboard')

  const [assetsRes, relRes] = await Promise.all([
    supabase.from('assets').select('id, name, asset_type').eq('status', 'active').order('name'),
    supabase.from('asset_relationships').select('id, source_asset_id, target_asset_id, relationship_type'),
  ])

  const assets = assetsRes.data ?? []
  const relationships = relRes.data ?? []

  const legend = [
    { type: 'server', color: '#3B82F6', label: 'Servidor' },
    { type: 'workstation', color: '#10B981', label: 'Workstation' },
    { type: 'network', color: '#F59E0B', label: 'Red' },
    { type: 'application', color: '#06B6D4', label: 'Aplicación' },
    { type: 'database', color: '#EF4444', label: 'Base de datos' },
    { type: 'service', color: '#EC4899', label: 'Servicio' },
  ]

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#F1F5F9]">Mapa visual CMDB</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">
            {assets.length} activos · {relationships.length} dependencias — arrastra para reorganizar
          </p>
        </div>
        <Link href="/admin/assets/dependencies"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#334155] hover:bg-[#475569] text-[#F1F5F9] text-xs transition-colors">
          <Network size={12} /> Gestionar dependencias
        </Link>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {legend.map(l => (
          <div key={l.type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
            <span className="text-xs text-[#64748B]">{l.label}</span>
          </div>
        ))}
        <span className="text-xs text-[#475569] ml-2">|</span>
        <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-[#EF4444]" /><span className="text-xs text-[#64748B]">depende de</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-[#10B981]" /><span className="text-xs text-[#64748B]">aloja</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-[#3B82F6]" /><span className="text-xs text-[#64748B]">conecta</span></div>
      </div>

      <CmdbVisualMap assets={assets} relationships={relationships} />
    </div>
  )
}
