'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

async function requireStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) throw new Error('Sin permiso')
  return { supabase, user }
}

const updateAssetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Nombre requerido'),
  asset_tag: z.string().optional(),
  asset_type: z.string(),
  status: z.string(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  location: z.string().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  warranty_expiry: z.string().optional(),
  notes: z.string().optional(),
})

export async function updateAsset(input: z.infer<typeof updateAssetSchema>) {
  const { supabase } = await requireStaff()
  const parsed = updateAssetSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const d = parsed.data

  const { error } = await supabase.from('assets').update({
    name: d.name.trim(),
    asset_tag: d.asset_tag?.trim() || null,
    asset_type: d.asset_type,
    status: d.status,
    manufacturer: d.manufacturer?.trim() || null,
    model: d.model?.trim() || null,
    serial_number: d.serial_number?.trim() || null,
    location: d.location?.trim() || null,
    organization_id: d.organization_id || null,
    warranty_expiry: d.warranty_expiry || null,
    notes: d.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', d.id)
  if (error) return { error: error.message }

  revalidatePath('/admin/assets')
  return { success: true }
}

// ── Vínculo activo ↔ ticket (ticket_assets) ──────────────────────────────────

export async function getTicketAssets(ticketId: string) {
  const { supabase } = await requireStaff()

  const { data: ticket } = await supabase.from('tickets').select('organization_id').eq('id', ticketId).single()

  const { data: linkedRows } = await supabase
    .from('ticket_assets')
    .select('asset_id, assets(id, name, asset_type, status)')
    .eq('ticket_id', ticketId)

  const linked = (linkedRows ?? []).map(r => {
    const a = Array.isArray(r.assets) ? r.assets[0] : r.assets
    return a as { id: string; name: string; asset_type: string; status: string }
  }).filter(Boolean)

  const linkedIds = new Set(linked.map(a => a.id))

  // Activos de la organización del ticket, no vinculados aún
  let availQuery = supabase.from('assets').select('id, name, asset_type').order('name')
  if (ticket?.organization_id) availQuery = availQuery.eq('organization_id', ticket.organization_id)
  const { data: allAssets } = await availQuery
  const available = (allAssets ?? []).filter(a => !linkedIds.has(a.id))

  return { linked, available }
}

export async function linkAssetToTicket(ticketId: string, assetId: string) {
  const { supabase } = await requireStaff()
  const { error } = await supabase.from('ticket_assets').insert({ ticket_id: ticketId, asset_id: assetId })
  if (error) return { error: error.message }
  revalidatePath(`/admin/tickets/${ticketId}`)
  revalidatePath(`/agent/tickets/${ticketId}`)
  return { success: true }
}

export async function unlinkAssetFromTicket(ticketId: string, assetId: string) {
  const { supabase } = await requireStaff()
  const { error } = await supabase.from('ticket_assets').delete().eq('ticket_id', ticketId).eq('asset_id', assetId)
  if (error) return { error: error.message }
  revalidatePath(`/admin/tickets/${ticketId}`)
  revalidatePath(`/agent/tickets/${ticketId}`)
  return { success: true }
}
