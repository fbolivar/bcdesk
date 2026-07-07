import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hashOrgToken } from '@/lib/api/org-token-crypto'

/**
 * Valida el header x-api-key contra org_api_tokens (activo) y devuelve la
 * organización asociada. TODAS las rutas /api/v1/* deben acotar sus consultas
 * a este organization_id — nunca exponer datos de otras organizaciones.
 * Devuelve null si el token falta o es inválido.
 */
export async function validateOrgToken(
  req: NextRequest,
): Promise<{ organizationId: string; tokenId: string; createdBy: string | null } | null> {
  const apiKey = req.headers.get('x-api-key')?.trim()
  if (!apiKey) return null

  const supabase = createServiceClient()
  const { data: token } = await supabase
    .from('org_api_tokens')
    .select('id, organization_id, is_active, created_by')
    .eq('token_hash', await hashOrgToken(apiKey))
    .maybeSingle()

  if (!token || !token.is_active || !token.organization_id) return null

  // Registra uso (fire and forget)
  supabase.from('org_api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', token.id).then(() => {})

  return { organizationId: token.organization_id, tokenId: token.id, createdBy: token.created_by ?? null }
}

export function unauthorized() {
  return Response.json(
    { error: 'No autorizado. Incluye un header x-api-key válido de tu organización.' },
    { status: 401 },
  )
}
