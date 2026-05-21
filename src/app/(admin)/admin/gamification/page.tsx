import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Trophy, Plus, Trash2, Target, Award } from 'lucide-react'

const BADGE_ICONS: Record<string, string> = {
  speed: '⚡',
  quality: '⭐',
  volume: '📦',
  csat: '😊',
  streak: '🔥',
  mentor: '🎓',
  veteran: '🏆',
}

export default async function GamificationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [agentsRes, badgesRes, goalsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').eq('role', 'agent'),
    supabase.from('agent_badges').select('*, profiles(full_name)').order('awarded_at', { ascending: false }),
    supabase.from('agent_goals').select('*, profiles(full_name)').order('period_end', { ascending: false }),
  ])

  const agents = agentsRes.data ?? []
  const badges = badgesRes.data ?? []
  const goals = goalsRes.data ?? []

  // Leaderboard: count badges per agent
  const badgeCounts: Record<string, { name: string; count: number }> = {}
  for (const b of badges) {
    const agentName = Array.isArray(b.profiles) ? b.profiles[0]?.full_name : (b.profiles as any)?.full_name
    if (!badgeCounts[b.agent_id]) badgeCounts[b.agent_id] = { name: agentName ?? '—', count: 0 }
    badgeCounts[b.agent_id].count++
  }
  const leaderboard = Object.entries(badgeCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 10)

  async function handleAwardBadge(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('agent_badges').insert({
      agent_id: formData.get('agent_id') as string,
      badge_type: formData.get('badge_type') as string,
      badge_name: formData.get('badge_name') as string,
      description: formData.get('description') as string || null,
      awarded_by: user?.id,
    })
    revalidatePath('/admin/gamification')
  }

  async function handleCreateGoal(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('agent_goals').insert({
      agent_id: formData.get('agent_id') as string,
      goal_type: formData.get('goal_type') as string,
      target_value: parseInt(formData.get('target_value') as string),
      period_start: formData.get('period_start') as string,
      period_end: formData.get('period_end') as string,
    })
    revalidatePath('/admin/gamification')
  }

  async function handleDeleteBadge(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('agent_badges').delete().eq('id', id)
    revalidatePath('/admin/gamification')
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Gamificación de agentes</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">Badges, metas y ranking para motivar al equipo de soporte</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Award badge */}
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4 flex items-center gap-2">
            <Award size={14} className="text-[#F59E0B]" /> Otorgar badge
          </h2>
          <form action={handleAwardBadge} className="space-y-3">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Agente</label>
              <select name="agent_id" required defaultValue=""
                className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
                <option value="" disabled>Selecciona agente...</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Tipo de badge</label>
              <select name="badge_type" defaultValue="quality"
                className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
                {Object.entries(BADGE_ICONS).map(([v, icon]) => (
                  <option key={v} value={v}>{icon} {v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Nombre del badge *</label>
              <input name="badge_name" required placeholder="ej: Resolvedor Veloz"
                className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Razón</label>
              <input name="description" placeholder="¿Por qué se otorga este badge?"
                className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
            </div>
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-white text-sm font-medium transition-colors">
              <Award size={14} /> Otorgar badge
            </button>
          </form>
        </div>

        {/* Create goal */}
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4 flex items-center gap-2">
            <Target size={14} className="text-[#10B981]" /> Crear meta
          </h2>
          <form action={handleCreateGoal} className="space-y-3">
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Agente</label>
              <select name="agent_id" required defaultValue=""
                className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
                <option value="" disabled>Selecciona agente...</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Tipo de meta</label>
              <select name="goal_type" defaultValue="tickets_resolved"
                className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
                <option value="tickets_resolved">Tickets resueltos</option>
                <option value="avg_resolution_hours">Tiempo promedio (h)</option>
                <option value="csat_score">Puntaje CSAT</option>
                <option value="first_contact_resolution">FCR (%)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">Valor objetivo</label>
              <input name="target_value" type="number" required placeholder="ej: 50"
                className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Inicio</label>
                <input name="period_start" type="date" required
                  className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]" />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Fin</label>
                <input name="period_end" type="date" required
                  className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]" />
              </div>
            </div>
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-sm font-medium transition-colors">
              <Target size={14} /> Crear meta
            </button>
          </form>
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4 flex items-center gap-2">
            <Trophy size={14} className="text-[#F59E0B]" /> Ranking de agentes
          </h2>
          <div className="space-y-2">
            {leaderboard.map(([agentId, data], idx) => (
              <div key={agentId} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#0F172A]">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? 'bg-[#F59E0B] text-[#0F172A]' :
                  idx === 1 ? 'bg-[#94A3B8] text-[#0F172A]' :
                  idx === 2 ? 'bg-[#B45309] text-white' : 'bg-[#334155] text-[#94A3B8]'
                }`}>{idx + 1}</span>
                <span className="flex-1 text-sm font-medium text-[#F1F5F9]">{data.name}</span>
                <span className="text-xs text-[#F59E0B]">🏅 {data.count} badges</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent badges */}
      {badges.length > 0 && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#334155]">
            <span className="text-xs font-semibold text-[#64748B]">BADGES RECIENTES</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                {['Badge', 'Agente', 'Razón', 'Fecha', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {badges.slice(0, 20).map((b: any) => {
                const agentName = Array.isArray(b.profiles) ? b.profiles[0]?.full_name : b.profiles?.full_name
                return (
                  <tr key={b.id} className="border-b border-[#334155]/50 hover:bg-[#263248]">
                    <td className="px-4 py-3">
                      <span className="text-lg">{BADGE_ICONS[b.badge_type] ?? '🏅'}</span>
                      <span className="ml-2 text-sm font-medium text-[#F1F5F9]">{b.badge_name}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{agentName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">{b.description ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">
                      {new Date(b.awarded_at).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-3">
                      <form action={handleDeleteBadge.bind(null, b.id)}>
                        <button type="submit"
                          className="p-1.5 rounded text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {badges.length === 0 && goals.length === 0 && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-12 text-center">
          <Trophy size={32} className="text-[#334155] mx-auto mb-3" />
          <p className="text-[#64748B] text-sm">Sin badges ni metas aún. ¡Motiva a tu equipo!</p>
        </div>
      )}
    </div>
  )
}
