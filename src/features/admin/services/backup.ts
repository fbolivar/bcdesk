import { createServiceClient } from '@/lib/supabase/service'

/** Tablas de negocio incluidas en el respaldo, en orden de dependencia
 *  (padres primero) para que la restauración respete las llaves foráneas. */
export const BACKUP_TABLES: { name: string; pk: string }[] = [
  { name: 'organizations', pk: 'id' },
  { name: 'profiles', pk: 'id' },
  { name: 'sla_policies', pk: 'id' },
  { name: 'service_contracts', pk: 'id' },
  { name: 'contract_activities', pk: 'id' },
  { name: 'tickets', pk: 'id' },
  { name: 'ticket_comments', pk: 'id' },
  { name: 'ticket_attachments', pk: 'id' },
  { name: 'time_logs', pk: 'id' },
  { name: 'invoices', pk: 'id' },
  { name: 'invoice_items', pk: 'id' },
  { name: 'technical_visits', pk: 'id' },
  { name: 'technical_visit_attachments', pk: 'id' },
  { name: 'service_expense_categories', pk: 'id' },
  { name: 'service_expenses', pk: 'id' },
  { name: 'billing_profile', pk: 'id' },
  { name: 'org_branding', pk: 'id' },
  { name: 'scheduled_reports', pk: 'id' },
  { name: 'doc_counters', pk: 'scope' },
]

const FORMAT = 'FBB'
const VERSION = 1

/** Genera el contenido de un archivo .fbb (formato propio: JSON con la carga
 *  de datos codificada en base64). Devuelve el string a descargar. */
export async function buildBackup(generatedAt: string): Promise<{ content: string; tables: number; rows: number }> {
  const supabase = createServiceClient()
  const data: Record<string, unknown[]> = {}
  let rows = 0
  for (const t of BACKUP_TABLES) {
    const { data: r } = await supabase.from(t.name).select('*')
    data[t.name] = r ?? []
    rows += (r ?? []).length
  }
  const payload = Buffer.from(JSON.stringify(data), 'utf8').toString('base64')
  const content = JSON.stringify({ _format: FORMAT, _version: VERSION, _app: 'HexDesk', _generated_at: generatedAt, payload })
  return { content, tables: BACKUP_TABLES.length, rows }
}

export type RestoreResult = { ok: boolean; error?: string; restored?: Record<string, number> }

/** Restaura un archivo .fbb: sobrescribe por PK (upsert). No borra lo que no
 *  esté en el archivo. Devuelve el conteo restaurado por tabla. */
export async function restoreBackup(fileText: string): Promise<RestoreResult> {
  let parsed: { _format?: string; _version?: number; payload?: string }
  try {
    parsed = JSON.parse(fileText)
  } catch {
    return { ok: false, error: 'El archivo no es un respaldo válido (.fbb).' }
  }
  if (parsed._format !== FORMAT || !parsed.payload) {
    return { ok: false, error: 'Formato .fbb no reconocido.' }
  }

  let data: Record<string, unknown[]>
  try {
    data = JSON.parse(Buffer.from(parsed.payload, 'base64').toString('utf8'))
  } catch {
    return { ok: false, error: 'El contenido del respaldo está dañado.' }
  }

  const supabase = createServiceClient()
  const restored: Record<string, number> = {}
  for (const t of BACKUP_TABLES) {
    const rows = data[t.name]
    if (!Array.isArray(rows) || rows.length === 0) continue
    const { error } = await supabase.from(t.name).upsert(rows, { onConflict: t.pk })
    if (error) return { ok: false, error: `Fallo restaurando ${t.name}: ${error.message}`, restored }
    restored[t.name] = rows.length
  }
  return { ok: true, restored }
}
