import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdminApi } from '@/lib/api/require-admin'

export const runtime = 'nodejs'

const RANGE_MS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

// GET: histórico de métricas + inventario más reciente + historial de comandos.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi()
  if (guard.error) return guard.error
  const { id } = await params

  const range = req.nextUrl.searchParams.get('range') ?? '7d'
  const since = new Date(Date.now() - (RANGE_MS[range] ?? RANGE_MS['7d'])).toISOString()

  const admin = createServiceClient()

  const [endpointRes, metricsRes, inventoryRes, commandsRes] = await Promise.all([
    admin.from('endpoints')
      .select('id, organization_id, hostname, os, agent_version, status, last_seen_at, created_at, disabled_at')
      .eq('id', id).maybeSingle(),
    admin.from('endpoint_metrics')
      .select('cpu_pct, ram_pct, disk_free_pct, uptime_seconds, recorded_at')
      .eq('endpoint_id', id).gte('recorded_at', since)
      .order('recorded_at', { ascending: true }).limit(5000),
    admin.from('endpoint_inventory')
      .select('os_version, installed_apps, hotfixes, captured_at')
      .eq('endpoint_id', id).order('captured_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('endpoint_commands')
      .select('id, command_type, payload, status, result, requested_by, created_at, completed_at')
      .eq('endpoint_id', id).order('created_at', { ascending: false }).limit(50),
  ])

  if (!endpointRes.data) return NextResponse.json({ error: 'Endpoint no encontrado' }, { status: 404 })

  return NextResponse.json({
    endpoint: endpointRes.data,
    metrics: metricsRes.data ?? [],
    inventory: inventoryRes.data ?? null,
    commands: commandsRes.data ?? [],
  })
}
