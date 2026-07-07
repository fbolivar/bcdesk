'use client'

import { useState, useTransition } from 'react'
import { GitFork, X, Plus, Loader2 } from 'lucide-react'
import { splitTicket } from '@/features/tickets/services/split-ticket.action'

interface SubtaskRow {
  id: number
  title: string
}

interface SplitTicketButtonProps {
  parentId: string
  isSubtask: boolean
}

export function SplitTicketButton({ parentId, isSubtask }: SplitTicketButtonProps) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<SubtaskRow[]>([{ id: Date.now(), title: '' }])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (isSubtask) return null

  function addRow() {
    if (rows.length >= 10) return
    setRows((prev) => [...prev, { id: Date.now(), title: '' }])
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  function updateRow(id: number, title: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, title } : r)))
  }

  function handleClose() {
    if (isPending) return
    setOpen(false)
    setRows([{ id: Date.now(), title: '' }])
    setError(null)
  }

  function handleSubmit() {
    const subtasks = rows
      .map((r) => ({ title: r.title.trim() }))
      .filter((s) => s.title.length > 0)

    if (subtasks.length === 0) {
      setError('Agrega al menos una subtarea con título.')
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await splitTicket(parentId, subtasks)
        handleClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al crear subtareas')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545] hover:border-[#1789FC] text-sm transition-colors"
      >
        <GitFork size={14} />
        Dividir
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md bg-[#F4F7FB] border border-[#E6EBF2] rounded-2xl shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitFork size={16} className="text-[#1789FC]" />
                <h2 className="text-base font-semibold text-[#0B2545]">
                  Dividir ticket en subtareas
                </h2>
              </div>
              <button
                onClick={handleClose}
                disabled={isPending}
                className="text-[#5B6B7C] hover:text-[#5B6B7C] transition-colors disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Subtask rows */}
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="text-xs text-[#5B6B7C] w-5 text-right shrink-0">
                    {index + 1}.
                  </span>
                  <input
                    type="text"
                    value={row.title}
                    onChange={(e) => updateRow(row.id, e.target.value)}
                    placeholder="Título de la subtarea..."
                    disabled={isPending}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#FFFFFF] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] text-sm focus:outline-none focus:border-[#1789FC] transition-colors disabled:opacity-50"
                  />
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(row.id)}
                      disabled={isPending}
                      className="text-[#5B6B7C] hover:text-[#EF4444] transition-colors disabled:opacity-50 shrink-0"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add row */}
            {rows.length < 10 && (
              <button
                onClick={addRow}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 text-xs text-[#1789FC] hover:text-[#6FA3FF] transition-colors disabled:opacity-50"
              >
                <Plus size={13} />
                Agregar subtarea
              </button>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={handleClose}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm text-[#5B6B7C] hover:text-[#0B2545] transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#3B7AEE] text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <GitFork size={14} />
                    Crear subtareas
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
