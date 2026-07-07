import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Server, Plus, Trash2 } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import { AssetEditModal } from '@/features/admin/components/asset-edit-modal'

const TYPE_LABEL: Record<string, string> = {
  hardware: 'Hardware', software: 'Software', network: 'Red', service: 'Servicio', other: 'Otro',
}
const STATUS_COLOR: Record<string, string> = {
  active: 'bg-[#10B981]/20 text-[#10B981]',
  inactive: 'bg-[#E6EBF2] text-[#5B6B7C]',
  maintenance: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  retired: 'bg-[#EF4444]/20 text-[#EF4444]',
  disposed: 'bg-[#E6EBF2] text-[#CBD5E1]',
}

export default async function AssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin','agent'].includes(profile.role)) redirect('/dashboard')

  const { data: assets } = await supabase
    .from('assets')
    .select('*, profiles!assets_assigned_to_fkey(full_name), organizations(name)')
    .order('name')

  const { data: orgs } = await supabase.from('organizations').select('id, name').eq('status', 'active')
  const { data: agents } = await supabase.from('profiles').select('id, full_name').in('role', ['admin','agent','client'])

  const list = assets ?? []

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { error } = await supabase.from('assets').insert({
      name: formData.get('name') as string,
      asset_tag: formData.get('asset_tag') as string || null,
      asset_type: formData.get('asset_type') as string || 'hardware',
      status: 'active',
      manufacturer: formData.get('manufacturer') as string || null,
      model: formData.get('model') as string || null,
      serial_number: formData.get('serial_number') as string || null,
      location: formData.get('location') as string || null,
      organization_id: formData.get('organization_id') as string || null,
      assigned_to: formData.get('assigned_to') as string || null,
      warranty_expiry: (formData.get('warranty_expiry') as string) || null,
    })
    if (error) {
      console.error('[assets create] error:', JSON.stringify(error))
      throw new Error(`No se pudo registrar el activo: ${error.message}`)
    }
    revalidatePath('/admin/assets')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('assets').delete().eq('id', id)
    revalidatePath('/admin/assets')
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">CMDB — Inventario de activos</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Gestiona los activos de hardware, software y red</p>
      </div>

      {/* Create */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Registrar activo</h2>
        <form action={handleCreate} className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Nombre *</label>
            <input name="name" required placeholder="ej: Laptop Dell XPS"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Tag / Código</label>
            <input name="asset_tag" placeholder="ej: LPT-001"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Tipo</label>
            <select name="asset_type"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Fabricante</label>
            <input name="manufacturer" placeholder="ej: Dell, HP, Cisco"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Modelo</label>
            <input name="model" placeholder="ej: XPS 15 9500"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Serial</label>
            <input name="serial_number" placeholder="Número de serie"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Ubicación</label>
            <input name="location" placeholder="ej: Oficina Bogotá"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Garantía hasta</label>
            <input name="warranty_expiry" type="date"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Organización</label>
            <select name="organization_id"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="">Sin organización</option>
              {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="col-span-3 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Registrar
            </button>
          </div>
        </form>
      </div>

      {/* Asset list */}
      {list.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Activo', 'Tag', 'Tipo', 'Estado', 'Organización', 'Garantía', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((a: any) => {
                const org = Array.isArray(a.organizations) ? a.organizations[0] : a.organizations
                const now = new Date()
                const warrantyExpired = a.warranty_expiry && new Date(a.warranty_expiry) < now
                return (
                  <tr key={a.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#0B2545]">{a.name}</p>
                      {a.model && <p className="text-xs text-[#5B6B7C]">{a.manufacturer} {a.model}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-[#5B6B7C]">{a.asset_tag ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">{TYPE_LABEL[a.asset_type]}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[a.status]}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5B6B7C]">{org?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {a.warranty_expiry ? (
                        <span className={warrantyExpired ? 'text-[#EF4444]' : 'text-[#10B981]'}>
                          {new Date(a.warranty_expiry).toLocaleDateString('es-CO')}
                          {warrantyExpired && ' (Vencida)'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <AssetEditModal asset={a} orgs={orgs ?? []} />
                        <form action={handleDelete.bind(null, a.id)}>
                          <button type="submit"
                            className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Server size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Sin activos registrados. Comienza registrando el primero.</p>
        </div>
      )}
    </div>
  )
}
