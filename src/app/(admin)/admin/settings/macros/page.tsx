import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Zap, Trash2, ToggleLeft, ToggleRight, Plus } from 'lucide-react'
import { createMacro, deleteMacro, toggleMacro } from '@/features/admin/services/macros.service'
import { MacroForm } from './macro-form'

export default async function AdminMacrosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const { data: agents } = await supabase.from('profiles').select('id, full_name').in('role', ['admin','agent']).eq('is_active', true)
  const { data: macros } = await supabase.from('macros').select('*').order('created_at', { ascending: false })
  const list = macros ?? []

  const ACTION_TYPE_LABELS: Record<string, string> = {
    set_status: 'Estado →', set_priority: 'Prioridad →', assign_to: 'Asignar a',
    assign_to_group: 'Grupo →', add_tag: 'Agregar etiqueta', add_comment: 'Comentar',
    add_internal_note: 'Nota interna', notify_email: 'Notificar', send_canned: 'Plantilla',
    change_status: 'Estado →',
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">Macros</h1>
          <p className="text-sm text-[#5B6B7C] mt-0.5">Acciones combinadas que se aplican con un clic</p>
        </div>
        <MacroForm agents={agents ?? []} action={createMacro} />
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Zap size={40} className="text-[#E6EBF2] mb-3" />
          <p className="text-[#5B6B7C]">Sin macros. Crea una para agilizar el trabajo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((macro: any) => (
            <div key={macro.id} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[#0B2545]">{macro.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${macro.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#E6EBF2] text-[#5B6B7C]'}`}>
                      {macro.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                    <span className="text-xs text-[#CBD5E1]">{macro.use_count ?? 0} usos</span>
                  </div>
                  {macro.description && <p className="text-xs text-[#5B6B7C] mt-0.5">{macro.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(macro.actions as Array<{type:string;value?:string}>).map((a, i) => {
                      const val = a.value ?? ''
                      return (
                        <span key={i} className="flex items-center gap-1 text-xs bg-[#E6EBF2] text-[#5B6B7C] px-2 py-0.5 rounded">
                          <Zap size={10} />
                          <span className="text-[#5B6B7C]">{ACTION_TYPE_LABELS[a.type] ?? a.type}</span>
                          {val && <span>{val.length > 30 ? val.substring(0, 30) + '…' : val}</span>}
                        </span>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <form action={toggleMacro.bind(null, macro.id, !macro.is_active)}>
                    <button type="submit" className="p-1.5 rounded text-[#5B6B7C] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors">
                      {macro.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                  </form>
                  <form action={deleteMacro.bind(null, macro.id)}>
                    <button type="submit" className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
