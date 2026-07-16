export type SlaFields = {
  sla_policy_id: string | null
  sla_response_due_at: string | null
  sla_resolution_due_at: string | null
}

type SlaPolicyRow = {
  id: string
  response_time_minutes: number
  resolution_time_minutes: number
}

/** Resultado de la consulta de política (data/error, como devuelve supabase-js). */
type SlaQueryResult = { data: SlaPolicyRow | null; error: { message: string } | null }

/** Cliente Supabase mínimo que necesita esta función: sirve tanto el de servidor
 *  como el de servicio. Se mantiene deliberadamente superficial (`unknown`):
 *  describir la cadena completa del builder hace que TypeScript colapse con
 *  "type instantiation is excessively deep" al compararla con SupabaseClient. */
type SlaQueryable = { from: (table: string) => unknown }

/** Cadena del builder, ya acotada a lo que usamos. */
type SlaSelectChain = {
  select: (cols: string) => {
    eq: (col: string, val: unknown) => {
      eq: (col: string, val: unknown) => {
        order: (col: string, opts: { ascending: boolean }) => {
          limit: (n: number) => { maybeSingle: () => PromiseLike<SlaQueryResult> }
        }
      }
    }
  }
}

/**
 * Vencimientos de SLA según la política activa de esa prioridad.
 * Única fuente de verdad: la usan la creación de tickets (web y correo) y el
 * cambio de prioridad.
 *
 * LANZA si la consulta falla, a propósito. Antes cada sitio resolvía el SLA por
 * su cuenta y uno pedía una columna inexistente (`sla_policies.organization_id`):
 * la consulta fallaba entera, el error se ignoraba, la política quedaba en null
 * y el update escribía esos nulls. Resultado: cada cambio de prioridad borraba
 * el SLA del ticket y lo sacaba de las alertas, en silencio. Es preferible un
 * error visible a perder el SLA sin enterarse.
 *
 * Nota: `sla_policies` NO tiene organization_id; las políticas son globales por
 * prioridad. Si no hay política para esa prioridad, el ticket queda sin SLA
 * (comportamiento correcto: no hay nada que aplicar).
 */
export async function computeSla(supabase: SlaQueryable, priority: string): Promise<SlaFields> {
  const table = supabase.from('sla_policies') as SlaSelectChain
  const { data: policy, error } = await table
    .select('id, response_time_minutes, resolution_time_minutes')
    .eq('priority', priority)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`No se pudo resolver la política de SLA: ${error.message}`)

  const now = Date.now()
  return {
    sla_policy_id: policy?.id ?? null,
    sla_response_due_at: policy ? new Date(now + policy.response_time_minutes * 60000).toISOString() : null,
    sla_resolution_due_at: policy ? new Date(now + policy.resolution_time_minutes * 60000).toISOString() : null,
  }
}
