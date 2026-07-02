'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'

/**
 * Análisis de impacto (blast radius) de la CMDB.
 * Dado un activo (CI), calcula qué otros activos se verían afectados si éste falla,
 * siguiendo las relaciones de dependencia y la jerarquía padre→hijo, y correlaciona
 * los tickets abiertos y las organizaciones afectadas.
 */

interface AssetLite {
  id: string
  name: string
  asset_type: string | null
  status: string | null
  organization_id: string | null
  parent_asset_id: string | null
}

interface Relationship {
  source_asset_id: string
  target_asset_id: string
  relationship_type: string | null
}

export interface ImpactedAsset {
  id: string
  name: string
  asset_type: string | null
  status: string | null
  depth: number
}

export interface ImpactTicket {
  id: string
  ticket_number: number
  title: string
  status: string
  priority: string
  asset_name: string
}

export interface ImpactResult {
  root: { id: string; name: string } | null
  impacted: ImpactedAsset[]
  tickets: ImpactTicket[]
  organizationsAffected: number
  error?: string
}

const MAX_DEPTH = 6

export async function getAssetImpact(assetId: string): Promise<ImpactResult> {
  const user = await getCurrentUser()
  if (!user || !['admin', 'agent'].includes(user.role)) {
    return { root: null, impacted: [], tickets: [], organizationsAffected: 0, error: 'No autorizado' }
  }

  const supabase = await createClient()

  const [{ data: assets }, { data: rels }] = await Promise.all([
    supabase.from('assets').select('id, name, asset_type, status, organization_id, parent_asset_id'),
    supabase.from('asset_relationships').select('source_asset_id, target_asset_id, relationship_type'),
  ])

  const assetList = (assets ?? []) as AssetLite[]
  const relList = (rels ?? []) as Relationship[]
  const byId = new Map(assetList.map(a => [a.id, a]))

  const root = byId.get(assetId)
  if (!root) {
    return { root: null, impacted: [], tickets: [], organizationsAffected: 0, error: 'Activo no encontrado.' }
  }

  // Construir adyacencia de impacto: arista A→B significa "si A falla, B se ve afectado".
  const impactEdges = new Map<string, Set<string>>()
  const addEdge = (from: string, to: string) => {
    if (!impactEdges.has(from)) impactEdges.set(from, new Set())
    impactEdges.get(from)!.add(to)
  }

  // Jerarquía: si el padre falla, los hijos se afectan.
  for (const a of assetList) {
    if (a.parent_asset_id) addEdge(a.parent_asset_id, a.id)
  }

  // Relaciones: "depends_on/runs_on/hosted_on" → si el target falla, la fuente se afecta.
  // Otros tipos se tratan como bidireccionales.
  const dependencyTypes = new Set(['depends_on', 'runs_on', 'hosted_on', 'uses', 'requires'])
  for (const r of relList) {
    const type = (r.relationship_type ?? '').toLowerCase()
    if (dependencyTypes.has(type)) {
      addEdge(r.target_asset_id, r.source_asset_id)
    } else {
      addEdge(r.source_asset_id, r.target_asset_id)
      addEdge(r.target_asset_id, r.source_asset_id)
    }
  }

  // BFS desde el activo raíz.
  const impacted: ImpactedAsset[] = []
  const visited = new Set<string>([assetId])
  let frontier: string[] = [assetId]
  let depth = 0

  while (frontier.length > 0 && depth < MAX_DEPTH) {
    depth++
    const next: string[] = []
    for (const id of frontier) {
      for (const neighbor of impactEdges.get(id) ?? []) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        const a = byId.get(neighbor)
        if (a) {
          impacted.push({ id: a.id, name: a.name, asset_type: a.asset_type, status: a.status, depth })
          next.push(neighbor)
        }
      }
    }
    frontier = next
  }

  // Tickets abiertos vinculados al activo raíz o a cualquier afectado.
  const allIds = [assetId, ...impacted.map(i => i.id)]
  const { data: ticketLinks } = await supabase
    .from('ticket_assets')
    .select('asset_id, tickets(id, ticket_number, title, status, priority)')
    .in('asset_id', allIds)

  const openStatuses = new Set(['open', 'in_progress', 'waiting_client'])
  const tickets: ImpactTicket[] = []
  for (const link of (ticketLinks ?? []) as Array<{ asset_id: string; tickets: unknown }>) {
    const t = (Array.isArray(link.tickets) ? link.tickets[0] : link.tickets) as
      | { id: string; ticket_number: number; title: string; status: string; priority: string }
      | null
    if (t && openStatuses.has(t.status)) {
      tickets.push({
        id: t.id,
        ticket_number: t.ticket_number,
        title: t.title,
        status: t.status,
        priority: t.priority,
        asset_name: byId.get(link.asset_id)?.name ?? '',
      })
    }
  }

  // Organizaciones afectadas (distintas).
  const orgs = new Set<string>()
  for (const id of allIds) {
    const org = byId.get(id)?.organization_id
    if (org) orgs.add(org)
  }

  return {
    root: { id: root.id, name: root.name },
    impacted,
    tickets,
    organizationsAffected: orgs.size,
  }
}
