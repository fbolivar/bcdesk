'use client'

import { useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, Trash2, ArrowUp, ArrowDown, Save, GitBranch } from 'lucide-react'
import {
  saveApprovalWorkflow,
  deleteApprovalWorkflow,
  type ApprovalWorkflow,
  type ApprovalStep,
} from '../services/approval.service'

interface Staff { id: string; full_name: string }

const ENTITY_TYPES = [
  { value: 'change', label: 'Cambio (RFC)' },
  { value: 'service_request', label: 'Solicitud de servicio' },
  { value: 'purchase', label: 'Compra' },
  { value: 'other', label: 'Otro' },
]

function newStep(): ApprovalStep {
  return { id: crypto.randomUUID(), name: 'Aprobación', approver_type: 'role', approver_role: 'admin', mode: 'any' }
}

function emptyWorkflow(): ApprovalWorkflow {
  return { id: '', name: '', entity_type: 'change', steps: [newStep()], is_active: true }
}

export function ApprovalWorkflowBuilder({ workflows, staff }: { workflows: ApprovalWorkflow[]; staff: Staff[] }) {
  const [list, setList] = useState<ApprovalWorkflow[]>(workflows)
  const [draft, setDraft] = useState<ApprovalWorkflow | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function edit(w: ApprovalWorkflow) {
    setMsg(null)
    setDraft(JSON.parse(JSON.stringify(w)))
  }
  function create() {
    setMsg(null)
    setDraft(emptyWorkflow())
  }

  function updateStep(i: number, patch: Partial<ApprovalStep>) {
    if (!draft) return
    const steps = draft.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    setDraft({ ...draft, steps })
  }
  function moveStep(i: number, dir: -1 | 1) {
    if (!draft) return
    const j = i + dir
    if (j < 0 || j >= draft.steps.length) return
    const steps = [...draft.steps]
    ;[steps[i], steps[j]] = [steps[j], steps[i]]
    setDraft({ ...draft, steps })
  }
  function removeStep(i: number) {
    if (!draft) return
    setDraft({ ...draft, steps: draft.steps.filter((_, idx) => idx !== i) })
  }
  function addStep() {
    if (!draft) return
    setDraft({ ...draft, steps: [...draft.steps, newStep()] })
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    setMsg(null)
    const r = await saveApprovalWorkflow({
      id: draft.id || undefined,
      name: draft.name,
      entity_type: draft.entity_type,
      steps: draft.steps,
      is_active: draft.is_active,
    })
    setSaving(false)
    if (r.error) { setMsg(r.error); return }
    const saved = { ...draft, id: r.id! }
    setList(prev => {
      const exists = prev.some(w => w.id === saved.id)
      return exists ? prev.map(w => (w.id === saved.id ? saved : w)) : [saved, ...prev]
    })
    setDraft(saved)
    setMsg('Workflow guardado ✓')
  }

  async function remove() {
    if (!draft?.id) { setDraft(null); return }
    const r = await deleteApprovalWorkflow(draft.id)
    if (r.error) { setMsg(r.error); return }
    setList(prev => prev.filter(w => w.id !== draft.id))
    setDraft(null)
  }

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-5">
      {/* Lista */}
      <div className="space-y-2">
        <button
          onClick={create}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors"
        >
          <Plus size={14} /> Nuevo workflow
        </button>
        {list.length === 0 && <p className="text-xs text-[#5B6B7C] px-1 py-2">Sin workflows aún.</p>}
        {list.map(w => (
          <button
            key={w.id}
            onClick={() => edit(w)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
              draft?.id === w.id ? 'bg-[#1789FC]/10 border-[#1789FC]/40' : 'bg-[#FFFFFF] border-[#E6EBF2] hover:border-[#1789FC]/30'
            }`}
          >
            <p className="text-sm text-[#0B2545] truncate">{w.name || '(sin nombre)'}</p>
            <p className="text-[10px] text-[#5B6B7C]">{w.steps.length} paso(s) · {w.is_active ? 'activo' : 'inactivo'}</p>
          </button>
        ))}
      </div>

      {/* Editor */}
      {!draft ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-8 flex items-center justify-center">
          <p className="text-sm text-[#5B6B7C]">Selecciona o crea un workflow para editarlo.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Nombre del workflow</label>
                <input
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ej: Aprobación de cambios críticos"
                  className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Se aplica a</label>
                <select
                  value={draft.entity_type}
                  onChange={e => setDraft({ ...draft, entity_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]"
                >
                  {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={e => setDraft({ ...draft, is_active: e.target.checked })}
                className="w-4 h-4 rounded accent-[#10B981]"
              />
              <span className="text-xs text-[#5B6B7C]">Workflow activo</span>
            </label>
          </div>

          {/* Pasos */}
          <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#0B2545] flex items-center gap-2"><GitBranch size={15} className="text-[#1789FC]" /> Pasos de aprobación</h3>
              <button onClick={addStep} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545] hover:border-[#1789FC]/40 transition-colors">
                <Plus size={12} /> Agregar paso
              </button>
            </div>
            <div className="space-y-2">
              {draft.steps.map((step, i) => (
                <div key={step.id} className="rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-[#1789FC]/20 text-[#1789FC] text-xs flex items-center justify-center font-medium shrink-0">{i + 1}</span>
                    <input
                      value={step.name}
                      onChange={e => updateStep(i, { name: e.target.value })}
                      placeholder="Nombre del paso"
                      className="flex-1 px-2 py-1.5 rounded-md bg-[#FFFFFF] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]"
                    />
                    <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="p-1 text-[#5B6B7C] hover:text-[#0B2545] disabled:opacity-30"><ArrowUp size={13} /></button>
                    <button onClick={() => moveStep(i, 1)} disabled={i === draft.steps.length - 1} className="p-1 text-[#5B6B7C] hover:text-[#0B2545] disabled:opacity-30"><ArrowDown size={13} /></button>
                    <button onClick={() => removeStep(i)} className="p-1 text-[#5B6B7C] hover:text-[#EF4444]"><Trash2 size={13} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-8">
                    <select
                      value={step.approver_type}
                      onChange={e => updateStep(i, { approver_type: e.target.value as 'role' | 'user' })}
                      className="px-2 py-1.5 rounded-md bg-[#FFFFFF] border border-[#E6EBF2] text-[#5B6B7C] text-xs focus:outline-none focus:border-[#1789FC]"
                    >
                      <option value="role">Por rol</option>
                      <option value="user">Usuario específico</option>
                    </select>
                    {step.approver_type === 'role' ? (
                      <select
                        value={step.approver_role ?? 'admin'}
                        onChange={e => updateStep(i, { approver_role: e.target.value as 'admin' | 'agent' })}
                        className="px-2 py-1.5 rounded-md bg-[#FFFFFF] border border-[#E6EBF2] text-[#5B6B7C] text-xs focus:outline-none focus:border-[#1789FC]"
                      >
                        <option value="admin">Cualquier admin</option>
                        <option value="agent">Cualquier agente</option>
                      </select>
                    ) : (
                      <select
                        value={step.approver_id ?? ''}
                        onChange={e => updateStep(i, { approver_id: e.target.value })}
                        className="px-2 py-1.5 rounded-md bg-[#FFFFFF] border border-[#E6EBF2] text-[#5B6B7C] text-xs focus:outline-none focus:border-[#1789FC]"
                      >
                        <option value="">— Elige usuario —</option>
                        {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visualización */}
          <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-2">
            <WorkflowDiagram steps={draft.steps} staff={staff} />
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] disabled:opacity-50 text-white text-sm font-medium transition-colors">
              <Save size={14} /> {saving ? 'Guardando…' : 'Guardar workflow'}
            </button>
            <button onClick={remove} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 text-sm font-medium transition-colors">
              <Trash2 size={14} /> {draft.id ? 'Eliminar' : 'Descartar'}
            </button>
            {msg && <span className="text-xs text-[#10B981]">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function WorkflowDiagram({ steps, staff }: { steps: ApprovalStep[]; staff: Staff[] }) {
  const staffById = useMemo(() => new Map(staff.map(s => [s.id, s.full_name])), [staff])

  const { nodes, edges } = useMemo(() => {
    const nodeStyle = (bg: string, border: string) => ({
      background: bg, border: `2px solid ${border}`, borderRadius: '10px',
      padding: '8px 14px', color: '#0B2545', fontSize: '11px', fontWeight: 500,
      minWidth: '150px', textAlign: 'center' as const, whiteSpace: 'pre-line' as const,
    })
    const ns: Node[] = []
    const es: Edge[] = []
    ns.push({ id: 'start', position: { x: 0, y: 0 }, data: { label: '▶ Inicio' }, style: nodeStyle('#F4F7FB', '#10B981') })
    steps.forEach((s, i) => {
      const approver = s.approver_type === 'role'
        ? (s.approver_role === 'admin' ? 'Cualquier admin' : 'Cualquier agente')
        : (staffById.get(s.approver_id ?? '') ?? 'Usuario')
      ns.push({
        id: s.id,
        position: { x: 0, y: (i + 1) * 100 },
        data: { label: `${i + 1}. ${s.name}\n👤 ${approver}` },
        style: nodeStyle('#FFFFFF', '#1789FC'),
      })
      const prev = i === 0 ? 'start' : steps[i - 1].id
      es.push({ id: `e-${prev}-${s.id}`, source: prev, target: s.id, markerEnd: { type: MarkerType.ArrowClosed, color: '#1789FC' }, style: { stroke: '#1789FC', strokeWidth: 2 } })
    })
    ns.push({ id: 'end', position: { x: 0, y: (steps.length + 1) * 100 }, data: { label: '✓ Aprobado' }, style: nodeStyle('#F4F7FB', '#10B981') })
    if (steps.length > 0) {
      es.push({ id: `e-last-end`, source: steps[steps.length - 1].id, target: 'end', markerEnd: { type: MarkerType.ArrowClosed, color: '#10B981' }, style: { stroke: '#10B981', strokeWidth: 2 } })
    } else {
      es.push({ id: 'e-start-end', source: 'start', target: 'end', style: { stroke: '#5B6B7C', strokeWidth: 2 } })
    }
    return { nodes: ns, edges: es }
  }, [steps, staffById])

  return (
    <div className="h-[360px] rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        style={{ background: '#F4F7FB' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#FFFFFF" gap={20} />
      </ReactFlow>
    </div>
  )
}
