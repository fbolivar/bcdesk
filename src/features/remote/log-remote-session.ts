'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Registra una sesión de soporte remoto como nota interna en el ticket
 * (quién, cuándo — automático — y el ID de RustDesk si aplica).
 */
export async function logRemoteSession(input: { ticketId: string; type: 'screen' | 'control'; rustdeskId?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) return { error: 'Sin permiso' }

  const who = profile.full_name ?? 'Agente'
  const content = input.type === 'control'
    ? `🛠️ Sesión de control remoto (RustDesk) iniciada por ${who}${input.rustdeskId ? ` · ID: ${input.rustdeskId}` : ''}`
    : `🖥️ Sesión de soporte remoto (pantalla en vivo) iniciada por ${who}`

  const { error } = await supabase.from('ticket_comments').insert({
    ticket_id: input.ticketId,
    author_id: user.id,
    content,
    is_internal: true,
  })
  if (error) return { error: error.message }

  revalidatePath(`/agent/tickets/${input.ticketId}`)
  revalidatePath(`/admin/tickets/${input.ticketId}`)
  return { success: true }
}
