'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const REVALIDATE = '/admin/settings/skills-routing'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Sin permisos de administrador')
  return supabase
}

// ── Skills ──────────────────────────────────────────────────────────────────

export async function createSkill(formData: FormData) {
  const supabase = await requireAdmin()
  const { error } = await supabase.from('skills').insert({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    category: formData.get('category') as string,
    color: (formData.get('color') as string) || '#4F8AFF',
  })
  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}

export async function deleteSkill(skillId: string) {
  const supabase = await requireAdmin()
  const { error } = await supabase.from('skills').delete().eq('id', skillId)
  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}

// ── Agent Skills ─────────────────────────────────────────────────────────────

export async function assignSkillToAgent(agentId: string, skillId: string, level: number) {
  const supabase = await requireAdmin()
  const { error } = await supabase
    .from('agent_skills')
    .upsert({ agent_id: agentId, skill_id: skillId, level })
  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}

export async function removeSkillFromAgent(agentId: string, skillId: string) {
  const supabase = await requireAdmin()
  const { error } = await supabase
    .from('agent_skills')
    .delete()
    .eq('agent_id', agentId)
    .eq('skill_id', skillId)
  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}

// ── Routing Rules ─────────────────────────────────────────────────────────────

export async function createRoutingRule(formData: FormData) {
  const supabase = await requireAdmin()
  const { error } = await supabase.from('routing_rules').insert({
    name: formData.get('name') as string,
    skill_id: formData.get('skill_id') as string,
    ticket_category: (formData.get('ticket_category') as string) || null,
    ticket_priority: (formData.get('ticket_priority') as string) || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}

export async function deleteRoutingRule(ruleId: string) {
  const supabase = await requireAdmin()
  const { error } = await supabase.from('routing_rules').delete().eq('id', ruleId)
  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}

export async function toggleRoutingRule(ruleId: string, isActive: boolean) {
  const supabase = await requireAdmin()
  const { error } = await supabase
    .from('routing_rules')
    .update({ is_active: isActive })
    .eq('id', ruleId)
  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}

// ── Auto-Assign ───────────────────────────────────────────────────────────────

export async function autoAssignTicket(ticketId: string): Promise<string | null> {
  const supabase = await createClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('category, priority')
    .eq('id', ticketId)
    .single()

  if (!ticket) return null

  // Busca reglas activas que apliquen a categoría y/o prioridad del ticket
  const { data: rules } = await supabase
    .from('routing_rules')
    .select('skill_id')
    .eq('is_active', true)
    .or(`ticket_category.eq.${ticket.category},ticket_category.is.null`)
    .or(`ticket_priority.eq.${ticket.priority},ticket_priority.is.null`)

  if (!rules || rules.length === 0) return null

  const skillIds = rules.map((r: { skill_id: string }) => r.skill_id)

  // Encuentra agentes con esos skills, ordenados por nivel desc
  const { data: agents } = await supabase
    .from('agent_skills')
    .select('agent_id, level, profiles!agent_id(is_active)')
    .in('skill_id', skillIds)
    .order('level', { ascending: false })

  type AgentSkillRow = {
    agent_id: string
    level: number
    profiles: { is_active: boolean } | null
  }

  const activeAgent = (agents as AgentSkillRow[] | null)?.find(
    a => a.profiles?.is_active === true
  )

  if (!activeAgent) return null

  await supabase
    .from('tickets')
    .update({ assigned_to: activeAgent.agent_id })
    .eq('id', ticketId)

  return activeAgent.agent_id
}
