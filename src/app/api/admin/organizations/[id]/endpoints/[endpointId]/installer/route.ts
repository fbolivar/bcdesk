import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/api/require-admin'
import { generateOrgToken, hashOrgToken, tokenPrefix } from '@/lib/api/org-token-crypto'
import { installerFilename } from '@/lib/rmm/installer-scripts'

export const runtime = 'nodejs'

const EXPIRY_MS = 15 * 60 * 1000

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; endpointId: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { id: orgId, endpointId } = await params

  const admin = createServiceClient()

  const { data: endpoint } = await admin
    .from('endpoints')
    .select('id, organization_id, os, hostname, disabled_at')
    .eq('id', endpointId)
    .maybeSingle()

  if (!endpoint || endpoint.organization_id !== orgId) {
    return NextResponse.json({ error: 'Endpoint no encontrado para este cliente' }, { status: 404 })
  }
  if (endpoint.disabled_at) {
    return NextResponse.json({ error: 'El endpoint está deshabilitado' }, { status: 409 })
  }
  if (endpoint.os !== 'windows' && endpoint.os !== 'linux') {
    return NextResponse.json({ error: 'SO del endpoint inválido' }, { status: 400 })
  }

  // Regenerar el token del endpoint: el viejo queda invalidado (se guarda solo
  // el nuevo hash). Vuelve a 'pending' porque se está (re)aprovisionando.
  const rawToken = generateOrgToken()
  const { error: updErr } = await admin.from('endpoints').update({
    token_hash: await hashOrgToken(rawToken),
    token_prefix: tokenPrefix(rawToken),
    status: 'pending',
  }).eq('id', endpointId)
  if (updErr) return NextResponse.json({ error: 'No se pudo regenerar el token' }, { status: 500 })

  // Invalidar cualquier instalador previo sin usar (y borrar su token en plano).
  await admin.from('rmm_installers')
    .update({ used_at: new Date().toISOString(), agent_token: null })
    .eq('endpoint_id', endpointId).is('used_at', null)

  const downloadToken = generateOrgToken()
  const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString()
  const { error: insErr } = await admin.from('rmm_installers').insert({
    download_token: downloadToken,
    endpoint_id: endpointId,
    os: endpoint.os,
    agent_token: rawToken,
    expires_at: expiresAt,
    created_by: guard.user.id,
  })
  if (insErr) return NextResponse.json({ error: 'No se pudo generar el instalador' }, { status: 500 })

  await admin.from('audit_logs').insert({
    actor_id: guard.user.id, action: 'rmm.installer_generated',
    resource_type: 'endpoint', resource_id: endpointId, new_values: { os: endpoint.os },
  })

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  return NextResponse.json({
    download_url: `${appUrl}/api/rmm/install/${downloadToken}`,
    filename: installerFilename(endpoint.os, endpoint.hostname),
    os: endpoint.os,
    expires_at: expiresAt,
  })
}
