import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const STATUSES = ['open', 'in_progress', 'waiting_client', 'resolved', 'closed']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Solo comprobaba que hubiera sesión: un CLIENTE podía POSTear ids arbitrarios.
  // Hoy lo frena la RLS, pero un endpoint no debe apoyarse solo en eso.
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin' && me?.role !== 'agent') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { ids, action, value } = await req.json() as {
    ids: string[]
    action: 'assign' | 'status' | 'priority' | 'close' | 'delete'
    value?: string
  }

  if (!ids?.length) return NextResponse.json({ error: 'No tickets selected' }, { status: 400 })

  // `value` entraba crudo a la BD: se valida contra los valores permitidos.
  let updates: Record<string, unknown>
  switch (action) {
    case 'assign':
      if (value) {
        const { data: agent } = await supabase
          .from('profiles').select('id').eq('id', value).in('role', ['admin', 'agent']).maybeSingle()
        if (!agent) return NextResponse.json({ error: 'Agente inválido' }, { status: 400 })
      }
      updates = { assigned_to: value ?? null }
      break
    case 'status':
      if (!STATUSES.includes(value ?? '')) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
      updates = { status: value }
      break
    case 'priority':
      if (!PRIORITIES.includes(value ?? '')) return NextResponse.json({ error: 'Prioridad inválida' }, { status: 400 })
      updates = { priority: value }
      break
    case 'close':
      updates = { status: 'resolved', resolved_at: new Date().toISOString() }
      break
    case 'delete':
      updates = { status: 'closed' }
      break
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  // Antes devolvía { ok: true, affected: ids.length } aunque la RLS hubiera
  // bloqueado TODO: éxito fabricado. Ahora se cuenta lo realmente afectado.
  const { data: affected, error } = await supabase
    .from('tickets').update(updates).in('id', ids).select('id')
  if (error) return NextResponse.json({ error: 'No se pudo aplicar la acción' }, { status: 500 })

  return NextResponse.json({ ok: true, affected: affected?.length ?? 0 })
}
