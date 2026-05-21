import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Network, Plus, Trash2 } from 'lucide-react'

const REL_LABEL: Record<string, string> = {
  depends_on: 'Depende de',
  hosts: 'Aloja',
  connects_to: 'Conecta con',
  runs_on: 'Corre en',
  managed_by: 'Administrado por',
  backs_up: 'Respaldado por',
}
const REL_COLOR: Record<string, string> = {
  depends_on: 'text-[#EF4444]',
  hosts: 'text-[#10B981]',
  connects_to: 'text-[#3B82F6]',
  runs_on: 'text-[#8B5CF6]',
  managed_by: 'text-[#F59E0B]',
  backs_up: 'text-[#06B6D4]',
}

export default async function CmdbDependenciesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin','agent'].includes(profile.role)) redirect('/dashboard')

  const { data: assets } = await supabase.from('assets').select('id, name, asset_type').eq('status', 'active').order('name')
  const { data: relationships } = await supabase
    .from('asset_relationships')
    .select('*, source:assets!asset_relationships_source_asset_id_fkey(name,asset_type), target:assets!asset_relationships_target_asset_id_fkey(name,asset_type)')

  const assetList = assets ?? []
  const relList = relationships ?? []

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('asset_relationships').insert({
      source_asset_id: formData.get('source_asset_id') as string,
      target_asset_id: formData.get('target_asset_id') as string,
      relationship_type: formData.get('relationship_type') as string || 'depends_on',
      notes: formData.get('notes') as string || null,
    })
    revalidatePath('/admin/assets/dependencies')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('asset_relationships').delete().eq('id', id)
    revalidatePath('/admin/assets/dependencies')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Mapa de dependencias CMDB</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">Define relaciones entre activos para análisis de impacto</p>
      </div>

      {/* Create */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4">Nueva relación</h2>
        <form action={handleCreate} className="grid grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Activo origen</label>
            <select name="source_asset_id" required
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="">Selecciona...</option>
              {assetList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Tipo de relación</label>
            <select name="relationship_type" defaultValue="depends_on"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              {Object.entries(REL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Activo destino</label>
            <select name="target_asset_id" required
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="">Selecciona...</option>
              {assetList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button type="submit"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
            <Plus size={14} /> Vincular
          </button>
        </form>
      </div>

      {/* Dependency graph (text-based) */}
      {relList.length > 0 ? (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#334155] flex items-center gap-2">
            <Network size={14} className="text-[#64748B]" />
            <span className="text-xs font-semibold text-[#64748B]">DEPENDENCIAS ({relList.length})</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                {['Origen', 'Relación', 'Destino', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {relList.map((r: any) => {
                const src = Array.isArray(r.source) ? r.source[0] : r.source
                const tgt = Array.isArray(r.target) ? r.target[0] : r.target
                return (
                  <tr key={r.id} className="border-b border-[#334155]/50 hover:bg-[#263248]">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[#F1F5F9]">{src?.name}</p>
                      <p className="text-xs text-[#64748B]">{src?.asset_type}</p>
                    </td>
                    <td className={`px-4 py-3 text-xs font-medium ${REL_COLOR[r.relationship_type]}`}>
                      → {REL_LABEL[r.relationship_type]}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[#F1F5F9]">{tgt?.name}</p>
                      <p className="text-xs text-[#64748B]">{tgt?.asset_type}</p>
                    </td>
                    <td className="px-4 py-3">
                      <form action={handleDelete.bind(null, r.id)}>
                        <button type="submit"
                          className="p-1.5 rounded text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-12 text-center">
          <Network size={32} className="text-[#334155] mx-auto mb-3" />
          <p className="text-[#64748B] text-sm">Sin dependencias mapeadas. Comienza vinculando activos.</p>
        </div>
      )}
    </div>
  )
}
