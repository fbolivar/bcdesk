import { describe, it, expect } from 'vitest'
import { computeSla } from './sla'

/** Cliente falso: imita la cadena .from().select().eq().eq().order().limit().maybeSingle() */
function fakeSupabase(result: { data: unknown; error: { message: string } | null }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => result,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: () => chain } as any
}

describe('computeSla', () => {
  it('calcula los vencimientos con la politica activa', async () => {
    const r = await computeSla(
      fakeSupabase({ data: { id: 'pol-1', response_time_minutes: 60, resolution_time_minutes: 240 }, error: null }),
      'critical',
    )
    expect(r.sla_policy_id).toBe('pol-1')
    expect(r.sla_response_due_at).not.toBeNull()
    expect(r.sla_resolution_due_at).not.toBeNull()
    // Resolucion (240 min) debe vencer despues que respuesta (60 min).
    expect(Date.parse(r.sla_resolution_due_at!)).toBeGreaterThan(Date.parse(r.sla_response_due_at!))
  })

  it('sin politica para esa prioridad, el ticket queda sin SLA', async () => {
    const r = await computeSla(fakeSupabase({ data: null, error: null }), 'medium')
    expect(r).toEqual({ sla_policy_id: null, sla_response_due_at: null, sla_resolution_due_at: null })
  })

  // EL BUG REAL: se pedia sla_policies.organization_id (columna inexistente), la
  // consulta fallaba, el error se ignoraba y el update escribia nulls => cada
  // cambio de prioridad borraba el SLA y sacaba al ticket de las alertas.
  it('si la consulta falla, LANZA en vez de devolver nulls que borrarian el SLA', async () => {
    await expect(
      computeSla(
        fakeSupabase({ data: null, error: { message: 'column sla_policies.organization_id does not exist' } }),
        'high',
      ),
    ).rejects.toThrow(/No se pudo resolver la política de SLA/)
  })
})
