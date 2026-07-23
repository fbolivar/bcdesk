import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/api/require-admin'
import { generateOrgToken, hashOrgToken, tokenPrefix } from '@/lib/api/org-token-crypto'
import { buildWindowsInstaller, buildLinuxInstaller } from '@/lib/rmm/installer-scripts'
import { agentBinaryUrl } from '@/lib/rmm/agent-binaries'

export const runtime = 'nodejs'

/**
 * Instalador GENÉRICO por cliente: un solo instalador que se corre en todos los
 * equipos. Lleva el "enroll token" del cliente (no un token por equipo); cada
 * máquina se auto-registra en el primer arranque vía /api/rmm/enroll.
 *
 * Genera (rota) el enroll token del cliente y devuelve los scripts de Windows y
 * Linux con ESE mismo token, para que una sola generación cubra ambos SO. Rotar
 * invalida instaladores genéricos previos sin usar; los agentes ya enrolados
 * siguen con su token individual y no se ven afectados.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { id: orgId } = await params

  const admin = createServiceClient()
  const { data: org } = await admin.from('organizations').select('id, rmm_enabled').eq('id', orgId).maybeSingle()
  if (!org) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  if (!org.rmm_enabled) {
    return NextResponse.json({ error: 'El módulo RMM no está activo para este cliente. Actívalo primero.' }, { status: 409 })
  }

  const enrollToken = generateOrgToken()
  const { error: updErr } = await admin.from('organizations').update({
    rmm_enroll_token_hash: await hashOrgToken(enrollToken),
    rmm_enroll_token_prefix: tokenPrefix(enrollToken),
  }).eq('id', orgId)
  if (updErr) return NextResponse.json({ error: 'No se pudo generar el token de enrolamiento' }, { status: 500 })

  await admin.from('audit_logs').insert({
    actor_id: guard.user.id, action: 'rmm.enroll_token_generated',
    resource_type: 'organization', resource_id: orgId, new_values: {},
  })

  const serverUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const common = { serverUrl, token: enrollToken, enroll: true as const }

  return NextResponse.json({
    windows: {
      filename: 'hexdesk-install-generico.cmd',
      script: buildWindowsInstaller({ ...common, binaryUrl: agentBinaryUrl('windows') }),
    },
    linux: {
      filename: 'hexdesk-install-generico.sh',
      script: buildLinuxInstaller({ ...common, binaryUrl: agentBinaryUrl('linux') }),
    },
  })
}
