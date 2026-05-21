'use client'

import Link from 'next/link'
import { useState } from 'react'
import { StatusBadge, PriorityBadge } from '@/shared/components/priority-badge'
import { SLATimer } from '@/shared/components/sla-timer'
import { bulkUpdateTickets } from '@/features/admin/services/admin.service'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Ticket } from '@/lib/supabase/types'

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

const categoryLabels: Record<string, string> = {
  support: 'Soporte', development: 'Desarrollo',
  billing: 'Facturación', onboarding: 'Onboarding', other: 'Otro',
}

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#F0F4FF',
  borderRadius: '10px',
  padding: '6px 12px',
  fontSize: '12px',
  outline: 'none',
}

export function BulkTicketTable({ tickets, agents, page, totalPages, searchParams }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState('close')
  const [assignTo, setAssignTo] = useState('')
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
    setPending(true)
    const fd = new FormData()
    Array.from(selected).forEach(id => fd.append('ids', id))
    fd.set('action', bulkAction)
    if (bulkAction === 'assign') fd.set('agent_id', assignTo)
    await bulkUpdateTickets(fd)
    setSelected(new Set())
    setPending(false)
  }

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: 'rgba(79,138,255,0.08)',
            border: '1px solid rgba(79,138,255,0.2)',
          }}
        >
          <span className="text-sm font-medium" style={{ color: '#4F8AFF' }}>
            {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
          </span>
          <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} style={selectStyle}>
            <option value="close">Cerrar tickets</option>
            <option value="resolve">Marcar resueltos</option>
            <option value="assign">Asignar a agente...</option>
          </select>
          {bulkAction === 'assign' && (
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={selectStyle}>
              <option value="">Seleccionar agente</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleBulkSubmit}
            disabled={pending}
            className="px-4 py-1.5 rounded-xl text-white text-xs font-semibold transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #4F8AFF, #8B6FFF)', boxShadow: '0 0 12px rgba(79,138,255,0.3)' }}
          >
            {pending ? 'Aplicando...' : 'Aplicar'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs transition-colors"
            style={{ color: '#4A5568' }}
          >
            Cancelar
          </button>
        </div>
      )}

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#4F8AFF' }}
                />
              </th>
              {['#', 'Cliente', 'Título', 'Categoría', 'Prioridad', 'Estado', 'SLA', 'Asignado', 'Creado'].map(h => (
                <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#4A5568', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm" style={{ color: '#4A5568' }}>
                  No hay tickets con estos filtros
                </td>
              </tr>
            ) : tickets.map(t => (
              <tr
                key={t.id}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: selected.has(t.id) ? 'rgba(79,138,255,0.05)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!selected.has(t.id)) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { if (!selected.has(t.id)) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: '#4F8AFF' }}
                  />
                </td>
                <td className="px-3 py-3">
                  <Link href={`/admin/tickets/${t.id}`} className="font-mono text-xs hover:underline" style={{ color: '#4F8AFF' }}>
                    #{t.ticket_number}
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs max-w-[100px] truncate" style={{ color: '#8B9BB4' }}>
                  {t.organizations?.name ?? '—'}
                </td>
                <td className="px-3 py-3 max-w-[200px]">
                  <Link href={`/admin/tickets/${t.id}`} className="text-xs hover:text-[#4F8AFF] line-clamp-1 transition-colors" style={{ color: '#F0F4FF' }}>
                    {t.title}
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs" style={{ color: '#4A5568' }}>{categoryLabels[t.category]}</td>
                <td className="px-3 py-3"><PriorityBadge priority={t.priority} /></td>
                <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-3 py-3 min-w-[120px]">
                  <SLATimer dueAt={t.sla_resolution_due_at} createdAt={t.created_at} compact />
                </td>
                <td className="px-3 py-3 text-xs" style={{ color: '#4A5568' }}>
                  {t.assigned_to_profile?.full_name ?? '—'}
                </td>
                <td className="px-3 py-3 text-xs" style={{ color: '#4A5568' }}>
                  {format(new Date(t.created_at), 'dd MMM', { locale: es })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildUrl({ page: String(page - 1) })}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#8B9BB4' }}
            >
              ← Anterior
            </Link>
          )}
          <span className="text-xs" style={{ color: '#4A5568' }}>Pág {page} de {totalPages}</span>
          {page < totalPages && (
            <Link
              href={buildUrl({ page: String(page + 1) })}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#8B9BB4' }}
            >
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
