'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MonitorDot } from 'lucide-react'
import { StatusBadge, PriorityBadge } from '@/shared/components/priority-badge'
import { SLATimer } from '@/shared/components/sla-timer'
import { bulkUpdateTickets } from '@/features/admin/services/admin.service'
import { fmtDate } from '@/lib/date'
import type { Ticket } from '@/lib/supabase/types'
import { TICKET_CATEGORY_LABELS } from '@/lib/tickets/categories'

type TicketRow = Ticket & {
  organizations?: { name: string } | null
  assigned_to_profile?: { full_name: string } | null
}

interface Props {
  tickets: TicketRow[]
  agents: { id: string; full_name: string }[]
  page: number
  totalPages: number
  searchParams: Record<string, string>
}

const categoryLabels = TICKET_CATEGORY_LABELS as Record<string, string>

const selectStyle: React.CSSProperties = {
  background: '#F4F7FB',
  border: '1px solid #E6EBF2',
  color: '#0B2545',
  borderRadius: '10px',
  padding: '6px 12px',
  fontSize: '12px',
  outline: 'none',
}

export function BulkTicketTable({ tickets, agents, page, totalPages, searchParams }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState('close')
  const [assignTo, setAssignTo] = useState('')
  const [confirmDelete, setConfirmDelete] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const allSelected = selected.size === tickets.length && tickets.length > 0

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(tickets.map(t => t.id)))
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function buildUrl(updates: Record<string, string>) {
    const p = { ...searchParams, ...updates }
    const qs = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/admin/tickets${qs ? '?' + qs : ''}`
  }

  async function handleBulkSubmit() {
    if (selected.size === 0) return
    if (bulkAction === 'assign' && !assignTo) return
    // El borrado es permanente: exige escribir ELIMINAR.
    if (bulkAction === 'delete' && confirmDelete.trim().toUpperCase() !== 'ELIMINAR') return
    setPending(true)
    setResult(null)
    const fd = new FormData()
    Array.from(selected).forEach(id => fd.append('ids', id))
    fd.set('action', bulkAction)
    if (bulkAction === 'assign') fd.set('agent_id', assignTo)
    const res = await bulkUpdateTickets(fd)
    if (bulkAction === 'delete' && res) {
      const parts = [`${res.deleted} eliminado${res.deleted === 1 ? '' : 's'}`]
      if (res.skipped > 0) parts.push(`${res.skipped} omitido${res.skipped === 1 ? '' : 's'} (con cuenta de cobro u horas facturadas)`)
      setResult(parts.join(' · '))
    }
    setSelected(new Set())
    setConfirmDelete('')
    setPending(false)
  }

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: 'rgba(0, 212, 170,0.08)',
            border: '1px solid rgba(0, 212, 170,0.2)',
          }}
        >
          <span className="text-sm font-medium" style={{ color: '#00D4AA' }}>
            {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
          </span>
          <select value={bulkAction} onChange={e => { setBulkAction(e.target.value); setConfirmDelete('') }} style={selectStyle}>
            <option value="close">Cerrar tickets</option>
            <option value="resolve">Marcar resueltos</option>
            <option value="assign">Asignar a agente...</option>
            <option value="delete">Eliminar (permanente)…</option>
          </select>
          {bulkAction === 'assign' && (
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={selectStyle}>
              <option value="">Seleccionar agente</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
          )}
          {bulkAction === 'delete' && (
            <input
              value={confirmDelete}
              onChange={e => setConfirmDelete(e.target.value)}
              placeholder="Escribe ELIMINAR"
              style={{ ...selectStyle, borderColor: '#EF4444', width: 150 }}
            />
          )}
          <button
            onClick={handleBulkSubmit}
            disabled={pending || (bulkAction === 'delete' && confirmDelete.trim().toUpperCase() !== 'ELIMINAR')}
            className="px-4 py-1.5 rounded-xl text-white text-xs font-semibold transition-all disabled:opacity-50"
            style={bulkAction === 'delete'
              ? { background: '#EF4444', boxShadow: '0 0 12px rgba(239,68,68,0.3)' }
              : { background: 'linear-gradient(135deg, #00D4AA, #8B6FFF)', boxShadow: '0 0 12px rgba(0, 212, 170,0.3)' }}
          >
            {pending ? 'Aplicando...' : bulkAction === 'delete' ? `Eliminar ${selected.size}` : 'Aplicar'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs transition-colors"
            style={{ color: '#94A3B8' }}
          >
            Cancelar
          </button>
        </div>
      )}

      {result && (
        <div className="px-4 py-2.5 rounded-xl text-sm font-medium bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981]">
          {result}
        </div>
      )}

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        <div className="w-full overflow-x-auto"><table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #E6EBF2' }}>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#00D4AA' }}
                />
              </th>
              {['#', 'Cliente', 'Título', 'Categoría', 'Prioridad', 'Estado', 'SLA', 'Asignado', 'Creado'].map(h => (
                <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm" style={{ color: '#94A3B8' }}>
                  No hay tickets con estos filtros
                </td>
              </tr>
            ) : tickets.map(t => (
              <tr
                key={t.id}
                style={{
                  borderBottom: '1px solid #F4F7FB',
                  background: selected.has(t.id) ? 'rgba(0, 212, 170,0.05)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!selected.has(t.id)) (e.currentTarget as HTMLTableRowElement).style.background = '#FFFFFF' }}
                onMouseLeave={e => { if (!selected.has(t.id)) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: '#00D4AA' }}
                  />
                </td>
                <td className="px-3 py-3">
                  <Link href={`/admin/tickets/${t.id}`} className="font-mono text-xs hover:underline" style={{ color: '#00D4AA' }}>
                    #{t.ticket_number}
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs max-w-[100px] truncate" style={{ color: '#5B6B7C' }}>
                  {t.organizations?.name ?? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#E6EBF2] text-[#5B6B7C]"
                      title="Ticket interno: ningún cliente puede verlo">
                      Interno
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 max-w-[200px]">
                  <div className="flex items-center gap-1.5">
                    {t.source_channel === 'rmm' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: 'rgba(14,158,134,0.12)', color: '#0E9E86' }}
                        title="Originado por monitoreo RMM (alerta automática de un equipo)">
                        <MonitorDot size={10} /> RMM
                      </span>
                    )}
                    <Link href={`/admin/tickets/${t.id}`} className="text-xs hover:text-[#0E9E86] line-clamp-1 transition-colors" style={{ color: '#0B2545' }}>
                      {t.title}
                    </Link>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs" style={{ color: '#94A3B8' }}>{categoryLabels[t.category]}</td>
                <td className="px-3 py-3"><PriorityBadge priority={t.priority} /></td>
                <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-3 py-3 min-w-[120px]">
                  <SLATimer dueAt={t.sla_resolution_due_at} createdAt={t.created_at} compact />
                </td>
                <td className="px-3 py-3 text-xs" style={{ color: '#94A3B8' }}>
                  {t.assigned_to_profile?.full_name ?? '—'}
                </td>
                <td className="px-3 py-3 text-xs" style={{ color: '#94A3B8' }}>
                  {fmtDate(t.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildUrl({ page: String(page - 1) })}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: '#F4F7FB', border: '1px solid #E6EBF2', color: '#5B6B7C' }}
            >
              ← Anterior
            </Link>
          )}
          <span className="text-xs" style={{ color: '#94A3B8' }}>Pág {page} de {totalPages}</span>
          {page < totalPages && (
            <Link
              href={buildUrl({ page: String(page + 1) })}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: '#F4F7FB', border: '1px solid #E6EBF2', color: '#5B6B7C' }}
            >
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
