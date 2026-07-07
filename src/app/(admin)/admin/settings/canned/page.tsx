import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MessageSquare, Plus, CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import { createCannedResponse, updateCannedResponse, toggleCannedResponse, deleteCannedResponse } from '@/features/admin/services/canned.service'

const CATEGORY_OPTIONS = ['', 'soporte', 'facturación', 'desarrollo', 'onboarding', 'general']
const CATEGORY_LABELS: Record<string, string> = {
  '': 'General', soporte: 'Soporte', facturación: 'Facturación',
  desarrollo: 'Desarrollo', onboarding: 'Onboarding', general: 'General',
}

export default async function CannedResponsesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: responses } = await supabase
    .from('canned_responses')
    .select('*, profiles!created_by(full_name)')
    .order('category').order('title')

  const grouped = (responses ?? []).reduce<Record<string, typeof responses>>((acc, r) => {
    if (!r) return acc
    const key = r.category ?? 'general'
    acc[key] = acc[key] ?? []
    acc[key]!.push(r)
    return acc
  }, {})

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">Respuestas rápidas</h1>
          <p className="text-sm text-[#5B6B7C] mt-0.5">
            Plantillas de texto para responder tickets más rápido
          </p>
        </div>
      </div>

      {/* Create form */}
      <details className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl">
        <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-[#5B6B7C] hover:text-[#0B2545] select-none flex items-center gap-2">
          <Plus size={14} className="text-[#1789FC]" /> Nueva respuesta rápida
        </summary>
        <form action={createCannedResponse} className="px-5 pb-5 pt-3 border-t border-[#E6EBF2] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Título *</label>
              <input name="title" required placeholder="ej: Acuse de recibo"
                className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors placeholder-[#5B6B7C]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Categoría</label>
              <select name="category" defaultValue=""
                className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors">
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Contenido *</label>
            <textarea name="content" required rows={3} placeholder="Texto de la respuesta..."
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors resize-none placeholder-[#5B6B7C]" />
          </div>
          <button type="submit"
            className="px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
            Guardar
          </button>
        </form>
      </details>

      {/* Grouped list */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E6EBF2] flex items-center gap-2">
            <MessageSquare size={14} className="text-[#1789FC]" />
            <h2 className="text-sm font-semibold text-[#0B2545] capitalize">{CATEGORY_LABELS[category] ?? category}</h2>
            <span className="text-xs text-[#5B6B7C]">({items?.length})</span>
          </div>
          <div className="divide-y divide-[#E6EBF2]/50">
            {(items ?? []).map(r => (
              <details key={r.id} className="group">
                <summary className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-[#EEF2F7] transition-colors list-none">
                  {r.is_active
                    ? <CheckCircle2 size={13} className="text-[#10B981] shrink-0" />
                    : <XCircle size={13} className="text-[#5B6B7C] shrink-0" />}
                  <span className="text-sm font-medium text-[#0B2545] flex-1">{r.title}</span>
                  <span className="text-xs text-[#5B6B7C] truncate max-w-[200px] hidden md:block">{r.content}</span>
                  <span className="text-[10px] text-[#5B6B7C] group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-5 pb-4 pt-3 border-t border-[#E6EBF2]/50 bg-[#F4F7FB]/30 space-y-3">
                  <form action={updateCannedResponse} className="space-y-3">
                    <input type="hidden" name="id" value={r.id} />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[#5B6B7C] mb-1">Título</label>
                        <input name="title" defaultValue={r.title}
                          className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#5B6B7C] mb-1">Categoría</label>
                        <select name="category" defaultValue={r.category ?? ''}
                          className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors">
                          {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#5B6B7C] mb-1">Contenido</label>
                      <textarea name="content" defaultValue={r.content} rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors resize-none" />
                    </div>
                    <button type="submit"
                      className="px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
                      Guardar cambios
                    </button>
                  </form>
                  <div className="flex gap-2">
                    <form action={toggleCannedResponse}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="is_active" value={String(r.is_active)} />
                      <button type="submit"
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          r.is_active
                            ? 'border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10'
                            : 'border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/10'
                        }`}>
                        {r.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                    <form action={deleteCannedResponse}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit"
                        className="px-3 py-1.5 rounded-lg text-xs border border-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors flex items-center gap-1.5">
                        <Trash2 size={11} /> Eliminar
                      </button>
                    </form>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      ))}

      {Object.keys(grouped).length === 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <MessageSquare size={24} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Aún no hay respuestas rápidas. Crea la primera arriba.</p>
        </div>
      )}
    </div>
  )
}
