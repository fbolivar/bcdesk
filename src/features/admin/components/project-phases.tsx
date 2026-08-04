'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Trash2, Loader2, Check } from 'lucide-react'
import { fmtDateOnly } from '@/lib/date'
import { updatePhase, deletePhase } from '@/features/admin/services/admin.service'
import type { ProjectPhase } from '@/lib/supabase/types'

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'pending',     label: 'Pendiente',   color: '#5B6B7C' },
  { value: 'in_progress', label: 'En progreso', color: '#0E9E86' },
  { value: 'completed',   label: 'Completado',  color: '#10B981' },
  { value: 'blocked',     label: 'Bloqueado',   color: '#EF4444' },
]

function PhaseRow({ phase, index, projectId }: { phase: ProjectPhase; index: number; projectId: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<string>(phase.status)
  const [progress, setProgress] = useState<number>(phase.progress_percent ?? 0)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()

  const dirty = status !== phase.status || progress !== (phase.progress_percent ?? 0)

  function onStatusChange(next: string) {
    setStatus(next)
    // Conveniencia: completar la fase la lleva a 100%; retomar desde 100 baja a 0.
    if (next === 'completed') setProgress(100)
    else if (next === 'pending' && progress === 100) setProgress(0)
  }

  function save() {
    setError(null); setSaved(false)
    startSaving(async () => {
      const res = await updatePhase(phase.id, projectId, { status, progress })
      if (res?.error) { setError(res.error); return }
      setSaved(true); setTimeout(() => setSaved(false), 2000)
      router.refresh()
    })
  }

  function remove() {
    if (!confirm(`¿Eliminar la fase "${phase.name}"?`)) return
    setError(null)
    startDeleting(async () => {
      const res = await deletePhase(phase.id, projectId)
      if (res?.error) { setError(res.error); return }
      router.refresh()
    })
  }

  const statusColor = STATUS_OPTIONS.find(s => s.value === status)?.color ?? '#5B6B7C'

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-xs font-mono text-[#5B6B7C] w-5 pt-1">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#0B2545]">{phase.name}</p>
          {phase.description && <p className="text-xs text-[#5B6B7C] mt-0.5">{phase.description}</p>}
          {(phase.start_date || phase.end_date) && (
            <div className="flex gap-4 mt-1">
              {phase.start_date && <span className="text-[10px] text-[#5B6B7C]">Inicio: {fmtDateOnly(phase.start_date)}</span>}
              {phase.end_date && <span className="text-[10px] text-[#5B6B7C]">Fin: {fmtDateOnly(phase.end_date)}</span>}
            </div>
          )}

          {/* Controles de avance */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <select
              value={status}
              onChange={e => onStatusChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-xs focus:outline-none focus:border-[#00D4AA]"
              style={{ color: statusColor }}
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <input
                type="range" min={0} max={100} step={5}
                value={progress}
                onChange={e => setProgress(Number(e.target.value))}
                className="flex-1 accent-[#00D4AA]"
              />
              <span className="text-xs font-mono text-[#0B2545] w-9 text-right">{progress}%</span>
            </div>

            <button
              onClick={save}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-xs font-medium transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : <Save size={13} />}
              {saved ? 'Guardado' : 'Guardar'}
            </button>

            <button
              onClick={remove}
              disabled={deleting}
              title="Eliminar fase"
              className="p-1.5 rounded-lg text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors disabled:opacity-40"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
          {error && <p className="text-[11px] text-[#EF4444] mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}

export function ProjectPhases({ projectId, phases }: { projectId: string; phases: ProjectPhase[] }) {
  if (phases.length === 0) {
    return <p className="text-sm text-[#5B6B7C]">Sin fases definidas. Agrega la primera abajo.</p>
  }
  return (
    <div className="space-y-2">
      {phases.map((phase, i) => (
        <PhaseRow key={phase.id} phase={phase} index={i} projectId={projectId} />
      ))}
    </div>
  )
}
