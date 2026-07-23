import { createServiceClient } from '@/lib/supabase/service'
import { hashOrgToken } from '@/lib/api/org-token-crypto'

/**
 * Autenticación del AGENTE (no de un usuario). El agente presenta su token; el
 * servidor lo hashea (SHA-256, mismo esquema que org_api_tokens) y busca el
 * endpoint dueño de ese hash. El endpoint_id se DERIVA del token — el agente
 * nunca lo envía, así que no puede tocar otro endpoint aunque lo intente.
 *
 * Rechaza (401) si el token no existe o el endpoint está deshabilitado, y (403)
 * si el módulo RMM se apagó para ese cliente. Nunca revela cuál de los dos es.
 */
export type EndpointRow = {
  id: string
  organization_id: string
  status: string
  disabled_at: string | null
}

export type AgentAuth =
  | { ok: true; endpoint: EndpointRow }
  | { ok: false; status: number; error: string }

function extractToken(req: Request): string {
  const auth = req.headers.get('authorization') ?? ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return (req.headers.get('x-agent-token') ?? '').trim()
}

export async function authenticateAgent(req: Request): Promise<AgentAuth> {
  const raw = extractToken(req)
  if (!raw) return { ok: false, status: 401, error: 'Falta el token del agente' }

  const tokenHash = await hashOrgToken(raw)
  const admin = createServiceClient()

  const { data: endpoint } = await admin
    .from('endpoints')
    .select('id, organization_id, status, disabled_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!endpoint) return { ok: false, status: 401, error: 'Token inválido' }
  // Un endpoint deshabilitado responde 401 al instante (ajuste #2): el hash
  // sigue en BD para auditoría, pero el token ya no sirve.
  if (endpoint.status === 'disabled' || endpoint.disabled_at) {
    return { ok: false, status: 401, error: 'Endpoint deshabilitado' }
  }

  const { data: org } = await admin
    .from('organizations').select('rmm_enabled').eq('id', endpoint.organization_id).maybeSingle()
  if (!org?.rmm_enabled) return { ok: false, status: 403, error: 'RMM inactivo para este cliente' }

  return { ok: true, endpoint: endpoint as EndpointRow }
}
