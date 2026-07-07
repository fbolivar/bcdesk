import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus, ToggleLeft, ToggleRight, Trash2, Grid3X3 } from 'lucide-react'
import { createCatalogItem, toggleCatalogItem, deleteCatalogItem } from '@/features/admin/services/service-catalog.service'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-[#5B6B7C]/20 text-[#5B6B7C]',
  medium: 'bg-[#1789FC]/20 text-[#1789FC]',
  high: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  urgent: 'bg-[#EF4444]/20 text-[#EF4444]',
}

export default async function ServiceCatalogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: items } = await supabase
    .from('service_catalog_items')
    .select('*')
    .order('sort_order')
    .order('name')

  const list = items ?? []
  const categories = [...new Set(list.map(i => i.category))]

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Catálogo de servicios</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Define los tipos de solicitud disponibles para los clientes</p>
      </div>

      {/* Create form */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Nuevo servicio</h2>
        <form action={createCatalogItem} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Nombre *</label>
            <input name="name" required placeholder="ej: Soporte técnico"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Categoría</label>
            <input name="category" placeholder="ej: TI, RRHH, Finanzas"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#5B6B7C] mb-1">Descripción</label>
            <input name="description" placeholder="Describe cuándo usar este servicio"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Ícono (emoji)</label>
            <input name="icon" placeholder="🎫" defaultValue="🎫"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Prioridad por defecto</label>
            <select name="default_priority" defaultValue="medium"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">SLA (horas)</label>
            <input name="sla_hours" type="number" defaultValue="24" min="1"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Orden</label>
            <input name="sort_order" type="number" defaultValue="0"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Crear servicio
            </button>
          </div>
        </form>
      </div>

      {/* Catalog list grouped by category */}
      {categories.map(cat => (
        <div key={cat} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#E6EBF2] flex items-center gap-2">
            <Grid3X3 size={14} className="text-[#5B6B7C]" />
            <span className="text-xs font-semibold text-[#5B6B7C] uppercase tracking-wide">{cat}</span>
          </div>
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <tbody>
              {list.filter(i => i.category === cat).map(item => (
                <tr key={item.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3 w-10 text-xl">{item.icon}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#0B2545]">{item.name}</p>
                    {item.description && <p className="text-xs text-[#5B6B7C] mt-0.5">{item.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[item.default_priority] ?? ''}`}>
                      {item.default_priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{item.sla_hours}h SLA</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#E6EBF2] text-[#5B6B7C]'}`}>
                      {item.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <form action={toggleCatalogItem.bind(null, item.id, item.is_active)}>
                        <button type="submit" title={item.is_active ? 'Desactivar' : 'Activar'}
                          className="p-1.5 rounded text-[#5B6B7C] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors">
                          {item.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                      </form>
                      <form action={deleteCatalogItem.bind(null, item.id)}>
                        <button type="submit"
                          className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      ))}

      {list.length === 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Grid3X3 size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Sin servicios aún. Crea el primero arriba.</p>
        </div>
      )}
    </div>
  )
}
