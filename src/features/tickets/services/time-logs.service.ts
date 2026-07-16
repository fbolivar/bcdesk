'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getRequestIp } from '@/lib/audit/request-ip'

export async function logTime(ticketId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const hours = parseFloat(formData.get('hours') as string) || 0
  const minutes = Math.round(hours * 60)
  if (minutes <= 0) return { error: 'Las horas deben ser mayores que cero.' }

  // Estas horas son la base de la facturación por contrato: si no se guardan,
  // hay que enterarse. Antes el error se ignoraba y la página recargaba igual,
  // así que el agente creía haber registrado su tiempo y no había nada.
  const { error } = await supabase.from('time_logs').insert({
    ticket_id: ticketId,
    agent_id: user.id,
    minutes,
    description: formData.get('description') as string || null,
  })
  if (error) return { error: 'No se pudo registrar el tiempo. Intenta de nuevo.' }

  await supabase.from('audit_logs').insert({
    resource_type: 'ticket',
    resource_id: ticketId,
    actor_id: user.id,
    action: 'time_logged',
    new_values: { hours: `${hours}h` },
    ip_address: await getRequestIp(),
  })

  revalidatePath(`/agent/tickets/${ticketId}`)
  revalidatePath(`/admin/tickets/${ticketId}`)
  return { success: true }
}

export async function deleteTimeLog(logId: string, ticketId: string) {
  const supabase = await createClient()

  // Antes esta acción no verificaba NADA: cualquiera con sesión (incluido un
  // cliente) podía borrar horas facturables de cualquier ticket invocándola
  // por HTTP. Los Server Actions son endpoints, aunque el botón no se muestre.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin' && me?.role !== 'agent') return { error: 'Sin permiso' }

  // Una hora ya facturada no se borra: descuadraría una cuenta de cobro emitida.
  const { data: log } = await supabase
    .from('time_logs').select('billed').eq('id', logId).maybeSingle()
  if (!log) return { error: 'El registro no existe.' }
  if (log.billed) return { error: 'No se puede borrar: ese tiempo ya fue facturado.' }

  const { error } = await supabase.from('time_logs').delete().eq('id', logId)
  if (error) return { error: 'No se pudo eliminar el registro.' }

  revalidatePath(`/agent/tickets/${ticketId}`)
  revalidatePath(`/admin/tickets/${ticketId}`)
  return { success: true }
}
