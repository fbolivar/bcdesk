import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'

function getWeekDays(weekOffset = 0) {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default async function TimesheetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const weekDays = getWeekDays(0)
  const weekStart = weekDays[0].toISOString().split('T')[0]
  const weekEnd = weekDays[6].toISOString().split('T')[0]

  const [agentsRes, logsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').eq('role', 'agent').order('full_name'),
    supabase.from('time_logs')
      .select('*, tickets(title)')
      .gte('logged_at', weekStart)
      .lte('logged_at', weekEnd + 'T23:59:59'),
  ])

  const agents = agentsRes.data ?? []
  const logs = logsRes.data ?? []

  // Build grid: agentId -> date -> minutes
  const grid: Record<string, Record<string, number>> = {}
  const agentTotals: Record<string, number> = {}

  for (const log of logs) {
    const dateKey = log.logged_at?.split('T')[0] ?? ''
    if (!grid[log.agent_id]) grid[log.agent_id] = {}
    grid[log.agent_id][dateKey] = (grid[log.agent_id][dateKey] ?? 0) + (log.minutes ?? 0)
    agentTotals[log.agent_id] = (agentTotals[log.agent_id] ?? 0) + (log.minutes ?? 0)
  }

  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const totalsByDay: Record<string, number> = {}
  for (const day of weekDays) {
    const key = day.toISOString().split('T')[0]
    totalsByDay[key] = logs.filter(l => l.logged_at?.startsWith(key)).reduce((s, l) => s + (l.minutes ?? 0), 0)
  }

  const grandTotal = logs.reduce((s, l) => s + (l.minutes ?? 0), 0)

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1E293B]">Timesheet semanal</h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Semana del {weekDays[0].toLocaleDateString('es-CO')} al {weekDays[6].toLocaleDateString('es-CO')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#64748B]">Total semana</p>
          <p className="text-lg font-bold text-[#1E293B]">{(grandTotal / 60).toFixed(1)}h</p>
        </div>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E6EBF2]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] w-40">Agente</th>
              {weekDays.map((day, i) => (
                <th key={i} className="px-3 py-3 text-center text-xs font-medium text-[#64748B] min-w-[80px]">
                  <p>{dayNames[i]}</p>
                  <p className="text-[10px] text-[#CBD5E1]">{day.getDate()}/{day.getMonth() + 1}</p>
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Total</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(agent => (
              <tr key={agent.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-[#1E293B] truncate">{agent.full_name || agent.email}</p>
                </td>
                {weekDays.map((day, i) => {
                  const key = day.toISOString().split('T')[0]
                  const mins = grid[agent.id]?.[key] ?? 0
                  const hours = mins / 60
                  return (
                    <td key={i} className="px-3 py-3 text-center">
                      {mins > 0 ? (
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          hours >= 8 ? 'text-[#10B981] bg-[#10B981]/10' :
                          hours >= 4 ? 'text-[#F59E0B] bg-[#F59E0B]/10' :
                          'text-[#64748B] bg-[#E6EBF2]/50'
                        }`}>
                          {hours.toFixed(1)}h
                        </span>
                      ) : (
                        <span className="text-[#E6EBF2] text-xs">—</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-semibold text-[#1E293B]">
                    {((agentTotals[agent.id] ?? 0) / 60).toFixed(1)}h
                  </span>
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr className="bg-[#F4F7FB] border-t-2 border-[#E6EBF2]">
              <td className="px-4 py-3 text-xs font-semibold text-[#64748B]">TOTAL DÍA</td>
              {weekDays.map((day, i) => {
                const key = day.toISOString().split('T')[0]
                const mins = totalsByDay[key] ?? 0
                return (
                  <td key={i} className="px-3 py-3 text-center text-xs font-semibold text-[#64748B]">
                    {mins > 0 ? `${(mins / 60).toFixed(1)}h` : '—'}
                  </td>
                )
              })}
              <td className="px-4 py-3 text-center text-sm font-bold text-[#3B82F6]">
                {(grandTotal / 60).toFixed(1)}h
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {agents.length === 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Clock size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#64748B] text-sm">Sin agentes ni tiempos registrados esta semana.</p>
        </div>
      )}
    </div>
  )
}
