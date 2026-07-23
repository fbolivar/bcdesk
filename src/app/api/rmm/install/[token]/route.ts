import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildWindowsInstaller, buildLinuxInstaller, installerFilename } from '@/lib/rmm/installer-scripts'
import { agentBinaryUrl } from '@/lib/rmm/agent-binaries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Público (sin JWT): se autoriza con el download_token de la URL. Un solo uso.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createServiceClient()
  const nowIso = new Date().toISOString()

  // Claim ATÓMICO: marca used_at solo si estaba sin usar y no expiró. Devuelve
  // la fila (aún con agent_token). Si otro request ya lo tomó, no devuelve nada.
  const { data: claimed } = await admin
    .from('rmm_installers')
    .update({ used_at: nowIso })
    .eq('download_token', token)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .select('endpoint_id, os, agent_token')
    .maybeSingle()

  if (!claimed || !claimed.agent_token) {
    return NextResponse.json(
      { error: 'Este enlace ya fue usado o expiró. Genera un instalador nuevo desde HexDesk.' },
      { status: 410 },
    )
  }

  const os = claimed.os as 'windows' | 'linux'
  const { data: endpoint } = await admin.from('endpoints').select('hostname').eq('id', claimed.endpoint_id).maybeSingle()

  const serverUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const script = os === 'windows'
    ? buildWindowsInstaller({ serverUrl, token: claimed.agent_token, binaryUrl: agentBinaryUrl('windows'), hostname: endpoint?.hostname })
    : buildLinuxInstaller({ serverUrl, token: claimed.agent_token, binaryUrl: agentBinaryUrl('linux'), hostname: endpoint?.hostname })

  // Borrar el token en plano: ya se sirvió, no debe quedar en la BD.
  await admin.from('rmm_installers').update({ agent_token: null }).eq('download_token', token)

  await admin.from('audit_logs').insert({
    actor_id: null, action: 'rmm.installer_downloaded',
    resource_type: 'endpoint', resource_id: claimed.endpoint_id, new_values: { os },
  })

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${installerFilename(os, endpoint?.hostname)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
