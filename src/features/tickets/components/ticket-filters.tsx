'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useCallback } from 'react'
import { Filter, BookmarkPlus, X, Trash2, Bookmark } from 'lucide-react'
import { saveView, deleteView } from '@/features/tickets/services/views.service'

interface SavedView {
  id: string
  name: string
  filters: Record<string, string>
  is_shared: boolean
  owner_id: string
}

interface Props {
  savedViews?: SavedView[]
  currentUserId?: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'waiting_client', label: 'Esperando cliente' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'cancelled', label: 'Cancelado' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas las prioridades' },
  { value: 'critical', label: 'Crítica' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
]

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas las categorías' },
  { value: 'support', label: 'Soporte' },
  { value: 'development', label: 'Desarrollo' },
  { value: 'billing', label: 'Facturación' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'other', label: 'Otro' },
]

export function TicketFilters({ savedViews = [], currentUserId = '' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [viewName, setViewName] = useState('')
  const [shared, setShared] = useState(false)

  const status   = searchParams.get('status') ?? ''
  const priority = searchParams.get('priority') ?? ''
  const category = searchParams.get('category') ?? ''
  const search   = searchParams.get('search') ?? ''

  const hasFilters = !!(status || priority || category || search)

  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const clearFilters = () => router.push(pathname)

  const applyView = (v: SavedView) => {
    const params = new URLSearchParams()
    Object.entries(v.filters).forEach(([k, val]) => { if (val) params.set(k, val) })
    router.push(`${pathname}?${params.toString()}`)
  }

  async function handleSave() {
    if (!viewName.trim()) return
    await saveView(viewName, { status, priority, category, search }, shared)
    setViewName('')
    setShowSaveDialog(false)
  }

  const selectClass = "bg-[#FFFFFF] border border-[#E6EBF2] text-[#1E293B] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#3B82F6] cursor-pointer"

  return (
    <div className="space-y-2">
      {/* Saved views chips */}
      {savedViews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedViews.map(v => (
            <div key={v.id} className="flex items-center gap-1 group">
              <button onClick={() => applyView(v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-[#E6EBF2] text-[#64748B] hover:bg-[#CBD5E1] hover:text-[#1E293B] transition-colors">
                <Bookmark size={10} />
                {v.name}
                {v.is_shared && <span className="text-[#CBD5E1] ml-0.5">· compartida</span>}
              </button>
              {v.owner_id === currentUserId && (
                <button onClick={() => deleteView(v.id)}
                  className="opacity-0 group-hover:opacity-100 text-[#CBD5E1] hover:text-[#EF4444] transition-all ml-0.5">
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={e => updateFilter('search', e.target.value)}
          placeholder="Buscar tickets..."
          className="px-3 py-2 bg-[#FFFFFF] border border-[#E6EBF2] rounded-lg text-sm text-[#1E293B] placeholder-[#CBD5E1] focus:outline-none focus:border-[#3B82F6] w-48"
        />

        <select value={status} onChange={e => updateFilter('status', e.target.value)} className={selectClass}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select value={priority} onChange={e => updateFilter('priority', e.target.value)} className={selectClass}>
          {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select value={category} onChange={e => updateFilter('category', e.target.value)} className={selectClass}>
          {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {hasFilters && (
          <>
            <button onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-2 rounded text-sm text-[#64748B] hover:text-[#EF4444] transition-colors">
              <X size={14} /> Limpiar
            </button>
            <button onClick={() => setShowSaveDialog(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#E6EBF2] text-[#64748B] hover:text-[#1E293B] transition-colors">
              <BookmarkPlus size={14} /> Guardar vista
            </button>
          </>
        )}
      </div>

      {/* Save dialog inline */}
      {showSaveDialog && (
        <div className="flex items-center gap-2 p-3 bg-[#FFFFFF] border border-[#3B82F6]/50 rounded-lg">
          <input value={viewName} onChange={e => setViewName(e.target.value)}
            placeholder="Nombre de la vista"
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
            className="flex-1 bg-transparent text-sm text-[#1E293B] placeholder-[#CBD5E1] focus:outline-none" />
          <label className="flex items-center gap-1.5 text-xs text-[#64748B] cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />
            Compartir con equipo
          </label>
          <button onClick={handleSave}
            className="px-3 py-1.5 rounded bg-[#3B82F6] text-white text-xs font-medium hover:bg-[#2563EB] transition-colors whitespace-nowrap">
            Guardar
          </button>
          <button onClick={() => setShowSaveDialog(false)} className="text-[#64748B] hover:text-[#64748B]">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
