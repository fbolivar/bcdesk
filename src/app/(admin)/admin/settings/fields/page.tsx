import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { createCustomField, deleteCustomField, toggleCustomField } from '@/features/admin/services/custom-fields.service'
import { TICKET_CATEGORY_LABELS } from '@/lib/tickets/categories'

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Texto', number: 'Número', select: 'Lista', date: 'Fecha', boolean: 'Sí/No',
}
const CATEGORY_LABELS = TICKET_CATEGORY_LABELS as Record<string, string>

export default async function AdminFieldsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const { data: fields } = await supabase.from('custom_fields').select('*').order('order_index')
  const list = fields ?? []

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Campos personalizados</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Define campos extra que aparecen en los tickets según su categoría</p>
      </div>

      {/* Create form */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Nuevo campo</h2>
        <form action={createCustomField} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs text-[#5B6B7C] mb-1">Nombre del campo *</label>
            <input name="name" required placeholder="ej: Versión del software"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Tipo</label>
            <select name="field_type"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#5B6B7C] text-sm focus:outline-none focus:border-[#00D4AA]">
              {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Categoría (vacío = todas)</label>
            <select name="category"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#5B6B7C] text-sm focus:outline-none focus:border-[#00D4AA]">
              <option value="">Todas</option>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Opciones (para Lista, separadas por coma)</label>
            <input name="options" placeholder="Opción 1, Opción 2, Opción 3"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-[#5B6B7C] cursor-pointer">
              <input type="checkbox" name="required" value="true" className="w-4 h-4 rounded accent-[#00D4AA]" />
              Campo requerido
            </label>
            <button type="submit"
              className="ml-auto px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors whitespace-nowrap">
              Crear campo
            </button>
          </div>
        </form>
      </div>

      {/* Fields list */}
      {list.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Nombre', 'Tipo', 'Categoría', 'Req.', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((f: any) => (
                <tr key={f.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3">
                    <p className="text-[#0B2545] font-medium">{f.name}</p>
                    <p className="text-xs text-[#CBD5E1]">{f.field_key}</p>
                  </td>
                  <td className="px-4 py-3 text-[#5B6B7C]">{FIELD_TYPE_LABELS[f.field_type]}</td>
                  <td className="px-4 py-3 text-[#5B6B7C]">{f.category ? CATEGORY_LABELS[f.category] : 'Todas'}</td>
                  <td className="px-4 py-3 text-[#5B6B7C]">{f.required ? '✓' : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#E6EBF2] text-[#5B6B7C]'}`}>
                      {f.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-1">
                    <form action={async () => { 'use server'; await toggleCustomField(f.id, !f.is_active) }}>
                      <button type="submit" className="p-1.5 rounded text-[#5B6B7C] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors">
                        {f.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                    </form>
                    <form action={async () => { 'use server'; await deleteCustomField(f.id) }}>
                      <button type="submit" className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}
