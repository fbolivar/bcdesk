'use client'

import { useState } from 'react'
import { Clock, Plus, X, Trash2 } from 'lucide-react'
import { logTime, deleteTimeLog } from '@/features/tickets/services/time-logs.service'

interface TimeLog {
  id: string
  minutes: number
  description: string | null
  logged_at: string
  profiles?: { full_name: string } | null
}

interface Props {
  ticketId: string
  initialLogs: TimeLog[]
}

function formatMinutes(min: number) {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function TimeTracker({ ticketId, initialLogs }: Props) {
  const [logs, setLogs] = useState(initialLogs)
  const [open, setOpen] = useState(false)

  const totalMinutes = logs.reduce((acc, l) => acc + l.minutes, 0)

  async function handleLog(fd: FormData) {
    await logTime(ticketId, fd)
    setOpen(false)
  }

  async function handleDelete(logId: string) {
    setLogs(prev => prev.filter(l => l.id !== logId))
    await deleteTimeLog(logId, ticketId)
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[#5B6B7C]" />
          <span className="text-xs font-semibold text-[#5B6B7C]">Tiempo registrado</span>
          {totalMinutes > 0 && (
            <span className="text-xs font-bold text-[#1789FC]">{formatMinutes(totalMinutes)} total</span>
          )}
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 text-xs text-[#5B6B7C] hover:text-[#1789FC] transition-colors">
          <Plus size={12} /> Registrar
        </button>
      </div>

      {open && (
        <form action={handleLog} className="mb-3 p-3 bg-[#F4F7FB] border border-[#1789FC]/40 rounded-lg space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-[#5B6B7C] mb-1">Horas *</label>
              <input name="hours" type="number" step="0.25" min="0.25" max="24" required placeholder="1.5"
                className="w-full px-2 py-1.5 bg-[#FFFFFF] border border-[#E6EBF2] rounded text-sm text-[#0B2545] focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-[#5B6B7C] mb-1">Descripción</label>
              <input name="description" placeholder="Qué hiciste..."
                className="w-full px-2 py-1.5 bg-[#FFFFFF] border border-[#E6EBF2] rounded text-sm text-[#0B2545] focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="text-[#5B6B7C] hover:text-[#5B6B7C]">
              <X size={14} />
            </button>
            <button type="submit"
              className="px-3 py-1 rounded bg-[#1789FC] text-white text-xs font-medium hover:bg-[#0B72D6] transition-colors">
              Guardar
            </button>
          </div>
        </form>
      )}

      {logs.length === 0 ? (
        <p className="text-xs text-[#CBD5E1] text-center py-2">Sin tiempo registrado</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map(log => (
            <div key={log.id} className="flex items-center justify-between text-xs group">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1789FC] w-10">{formatMinutes(log.minutes)}</span>
                <span className="text-[#5B6B7C]">{log.profiles?.full_name ?? 'Agente'}</span>
                {log.description && <span className="text-[#CBD5E1] truncate max-w-[150px]">{log.description}</span>}
              </div>
              <button onClick={() => handleDelete(log.id)}
                className="opacity-0 group-hover:opacity-100 text-[#CBD5E1] hover:text-[#EF4444] transition-all">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
