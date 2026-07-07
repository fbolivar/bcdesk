'use client'

import { useState, useCallback } from 'react'
import { Plus, X, GripVertical, BarChart2, Ticket, Users, Clock, TrendingUp, Star } from 'lucide-react'

type Widget = {
  id: string
  widget_type: string
  title: string
  width: number
  height: number
  position_x: number
  position_y: number
}

type WidgetDef = {
  type: string
  label: string
  icon: React.ReactNode
  defaultTitle: string
  width: number
  height: number
}

const WIDGET_DEFS: WidgetDef[] = [
  { type: 'tickets_by_status', label: 'Tickets por estado', icon: <Ticket size={14} />, defaultTitle: 'Tickets por estado', width: 1, height: 1 },
  { type: 'tickets_by_priority', label: 'Tickets por prioridad', icon: <BarChart2 size={14} />, defaultTitle: 'Tickets por prioridad', width: 1, height: 1 },
  { type: 'tickets_trend', label: 'Tendencia de tickets', icon: <TrendingUp size={14} />, defaultTitle: 'Tendencia (30 días)', width: 2, height: 1 },
  { type: 'agent_leaderboard', label: 'Ranking de agentes', icon: <Star size={14} />, defaultTitle: 'Top agentes', width: 1, height: 2 },
  { type: 'sla_compliance', label: 'Cumplimiento SLA', icon: <Clock size={14} />, defaultTitle: 'SLA Compliance', width: 1, height: 1 },
  { type: 'open_tickets_count', label: 'Contador tickets abiertos', icon: <Ticket size={14} />, defaultTitle: 'Tickets abiertos', width: 1, height: 1 },
  { type: 'response_time', label: 'Tiempo de respuesta', icon: <Clock size={14} />, defaultTitle: 'Avg tiempo respuesta', width: 1, height: 1 },
  { type: 'active_clients', label: 'Clientes activos', icon: <Users size={14} />, defaultTitle: 'Clientes activos', width: 1, height: 1 },
]

interface Props {
  initialWidgets: Widget[]
  stats: Record<string, unknown>
  userId: string
}

function WidgetCard({ widget, onRemove, stats }: { widget: Widget; onRemove: (id: string) => void; stats: Record<string, unknown> }) {
  const renderContent = () => {
    const s = stats
    switch (widget.widget_type) {
      case 'open_tickets_count':
        return <div className="flex-1 flex items-center justify-center"><p className="text-4xl font-bold text-[#1789FC]">{String(s.openTickets ?? 0)}</p></div>
      case 'tickets_by_status':
        return (
          <div className="flex-1 space-y-2">
            {(s.byStatus as Array<{ status: string; count: number }> ?? []).map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <span className="text-xs text-[#5B6B7C]">{item.status}</span>
                <span className="text-xs font-medium text-[#0B2545]">{item.count}</span>
              </div>
            ))}
          </div>
        )
      case 'tickets_by_priority':
        return (
          <div className="flex-1 space-y-2">
            {(s.byPriority as Array<{ priority: string; count: number }> ?? []).map((item) => (
              <div key={item.priority} className="flex items-center justify-between">
                <span className="text-xs text-[#5B6B7C]">{item.priority}</span>
                <span className="text-xs font-medium text-[#0B2545]">{item.count}</span>
              </div>
            ))}
          </div>
        )
      case 'sla_compliance':
        return <div className="flex-1 flex items-center justify-center"><p className="text-4xl font-bold text-[#10B981]">{String(s.slaCompliance ?? 0)}%</p></div>
      case 'active_clients':
        return <div className="flex-1 flex items-center justify-center"><p className="text-4xl font-bold text-[#8B5CF6]">{String(s.activeClients ?? 0)}</p></div>
      case 'response_time':
        return <div className="flex-1 flex items-center justify-center flex-col">
          <p className="text-3xl font-bold text-[#F59E0B]">{String(s.avgResponseHours ?? '—')}</p>
          <p className="text-xs text-[#5B6B7C]">horas promedio</p>
        </div>
      case 'agent_leaderboard':
        return (
          <div className="flex-1 space-y-2">
            {(s.topAgents as Array<{ name: string; count: number }> ?? []).slice(0, 5).map((a, i) => (
              <div key={a.name} className="flex items-center gap-2">
                <span className="text-xs text-[#5B6B7C] w-4">{i + 1}.</span>
                <span className="text-xs text-[#0B2545] flex-1 truncate">{a.name}</span>
                <span className="text-xs font-medium text-[#5B6B7C]">{a.count}</span>
              </div>
            ))}
          </div>
        )
      case 'tickets_trend':
        return (
          <div className="flex-1 flex items-end gap-1">
            {(s.trend as number[] ?? []).map((v: number, i: number) => {
              const max = Math.max(...(s.trend as number[] ?? [1]))
              const h = max > 0 ? Math.round((v / max) * 48) : 2
              return (
                <div key={i} className="flex-1 bg-[#1789FC]/40 rounded-sm" style={{ height: `${h}px` }} title={String(v)} />
              )
            })}
          </div>
        )
      default:
        return <div className="flex-1 flex items-center justify-center text-xs text-[#5B6B7C]">Sin datos</div>
    }
  }

  return (
    <div className={`bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-3 flex flex-col group ${widget.width === 2 ? 'col-span-2' : ''}`}
      style={{ minHeight: widget.height > 1 ? '200px' : '120px' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <GripVertical size={12} className="text-[#E6EBF2] cursor-grab" />
          <p className="text-xs font-semibold text-[#5B6B7C]">{widget.title}</p>
        </div>
        <button onClick={() => onRemove(widget.id)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[#CBD5E1] hover:text-[#EF4444] transition-all">
          <X size={12} />
        </button>
      </div>
      {renderContent()}
    </div>
  )
}

export function DashboardBuilder({ initialWidgets, stats, userId }: Props) {
  const [widgets, setWidgets] = useState<Widget[]>(initialWidgets)
  const [showPicker, setShowPicker] = useState(false)

  const addWidget = useCallback(async (def: WidgetDef) => {
    const newWidget: Widget = {
      id: crypto.randomUUID(),
      widget_type: def.type,
      title: def.defaultTitle,
      width: def.width,
      height: def.height,
      position_x: 0,
      position_y: widgets.length,
    }

    await fetch('/api/dashboard/widgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newWidget, user_id: userId }),
    }).catch(() => {})

    setWidgets(prev => [...prev, newWidget])
    setShowPicker(false)
  }, [widgets.length, userId])

  const removeWidget = useCallback(async (id: string) => {
    await fetch(`/api/dashboard/widgets/${id}`, { method: 'DELETE' }).catch(() => {})
    setWidgets(prev => prev.filter(w => w.id !== id))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#5B6B7C]">Dashboard personalizable — arrastra y suelta para reorganizar</p>
        <button onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#0B2545] text-sm transition-colors">
          <Plus size={14} /> Agregar widget
        </button>
      </div>

      {/* Widget picker */}
      {showPicker && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#5B6B7C] mb-3">SELECCIONA UN WIDGET</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WIDGET_DEFS.map(def => (
              <button key={def.type} onClick={() => addWidget(def)}
                className="flex items-center gap-2 px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] hover:border-[#1789FC] rounded-lg text-sm text-[#0B2545] transition-colors">
                {def.icon}
                <span className="text-xs">{def.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {widgets.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {widgets.map(w => (
            <WidgetCard key={w.id} widget={w} onRemove={removeWidget} stats={stats} />
          ))}
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] border-dashed rounded-xl p-12 text-center">
          <BarChart2 size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Tu dashboard está vacío. Agrega widgets para comenzar.</p>
        </div>
      )}
    </div>
  )
}
