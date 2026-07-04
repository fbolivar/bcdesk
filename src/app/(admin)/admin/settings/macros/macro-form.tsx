'use client'

import { useState } from 'react'
import { Plus, X, Zap, Trash2 } from 'lucide-react'

interface Agent { id: string; full_name: string }
interface MacroAction { type: string; value: string }

interface Props {
  agents: Agent[]
  action: (formData: FormData) => Promise<void>
}

const ACTION_TYPES = [
  { value: 'set_status',   label: 'Cambiar estado' },
  { value: 'set_priority', label: 'Cambiar prioridad' },
  { value: 'assign_to',    label: 'Asignar a agente' },
  { value: 'add_tag',      label: 'Agregar etiquetas' },
  { value: 'add_comment',  label: 'Agregar comentario' },
]

const STATUS_OPTIONS = ['open','in_progress','waiting_client','resolved','closed']
const PRIORITY_OPTIONS = ['critical','high','medium','low']

export function MacroForm({ agents, action }: Props) {
  const [open, setOpen] = useState(false)
  const [actions, setActions] = useState<MacroAction[]>([])

  function addAction() { setActions(prev => [...prev, { type: 'set_status', value: 'open' }]) }
  function removeAction(i: number) { setActions(prev => prev.filter((_, idx) => idx !== i)) }
  function updateAction(i: number, field: 'type' | 'value', val: string) {
    setActions(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: val } : a))
  }

  async function handleSubmit(fd: FormData) {
    fd.set('actions', JSON.stringify(actions))
    await action(fd)
    setActions([])
    setOpen(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
        <Plus size={14} /> Nueva macro
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E6EBF2]">
              <h3 className="text-sm font-semibold text-[#1E293B]">Nueva macro</h3>
              <button onClick={() => setOpen(false)} className="text-[#64748B] hover:text-[#1E293B]"><X size={16} /></button>
            </div>
            <form action={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Nombre *</label>
                <input name="name" required
                  className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6]" />
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Descripción</label>
                <input name="description"
                  className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6]" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[#64748B]">Acciones</label>
                  <button type="button" onClick={addAction}
                    className="flex items-center gap-1 text-xs text-[#3B82F6] hover:text-[#60A5FA]">
                    <Plus size={12} /> Agregar acción
                  </button>
                </div>

                {actions.length === 0 && (
                  <p className="text-xs text-[#CBD5E1] text-center py-4 border border-dashed border-[#E6EBF2] rounded-lg">
                    Sin acciones. Agrega al menos una.
                  </p>
                )}

                <div className="space-y-2">
                  {actions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <select value={a.type} onChange={e => updateAction(i, 'type', e.target.value)}
                          className="px-2 py-1.5 bg-[#FFFFFF] border border-[#E6EBF2] rounded text-xs text-[#64748B] focus:outline-none">
                          {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>

                        {a.type === 'set_status' && (
                          <select value={a.value} onChange={e => updateAction(i, 'value', e.target.value)}
                            className="px-2 py-1.5 bg-[#FFFFFF] border border-[#E6EBF2] rounded text-xs text-[#64748B] focus:outline-none">
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                        {a.type === 'set_priority' && (
                          <select value={a.value} onChange={e => updateAction(i, 'value', e.target.value)}
                            className="px-2 py-1.5 bg-[#FFFFFF] border border-[#E6EBF2] rounded text-xs text-[#64748B] focus:outline-none">
                            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        )}
                        {a.type === 'assign_to' && (
                          <select value={a.value} onChange={e => updateAction(i, 'value', e.target.value)}
                            className="px-2 py-1.5 bg-[#FFFFFF] border border-[#E6EBF2] rounded text-xs text-[#64748B] focus:outline-none">
                            <option value="">Sin asignar</option>
                            {agents.map(ag => <option key={ag.id} value={ag.id}>{ag.full_name}</option>)}
                          </select>
                        )}
                        {(a.type === 'add_tag' || a.type === 'add_comment') && (
                          <input value={a.value} onChange={e => updateAction(i, 'value', e.target.value)}
                            placeholder={a.type === 'add_tag' ? 'tag1, tag2' : 'Texto del comentario'}
                            className="px-2 py-1.5 bg-[#FFFFFF] border border-[#E6EBF2] rounded text-xs text-[#1E293B] placeholder-[#CBD5E1] focus:outline-none" />
                        )}
                      </div>
                      <button type="button" onClick={() => removeAction(i)}
                        className="text-[#CBD5E1] hover:text-[#EF4444] mt-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-[#64748B] border border-[#E6EBF2] hover:border-[#CBD5E1] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={actions.length === 0}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[#3B82F6] hover:bg-[#2563EB] text-white transition-colors disabled:opacity-50">
                  Crear macro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
