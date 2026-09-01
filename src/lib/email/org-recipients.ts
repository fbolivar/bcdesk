/**
 * Destinatarios de comunicaciones dirigidas a UNA organización cliente.
 *
 * Regla única (para no repetir el fallo del incidente en cada envío): las
 * comunicaciones con datos financieros/privados del cliente (cuentas de cobro,
 * recordatorios, actas) van SOLO al/los contacto(s) RESPONSABLE(S) de la
 * organización (usuarios cliente con is_org_admin = true). Si la organización no
 * tiene un responsable designado, se cae a todos los usuarios activos para no
 * dejar la comunicación sin enviar.
 *
 * Úsalo en TODO envío dirigido a una organización, en vez de armar la lista a mano.
 */
// Cliente Supabase (RLS o service role): ambos exponen .from(). Se deja laxo a
// propósito para no arrastrar los tipos generados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOrgResponsibleEmails(supabase: any, organizationId: string): Promise<string[]> {
  if (!organizationId) return []
  const { data } = await supabase
    .from('profiles')
    .select('email, is_org_admin')
    .eq('organization_id', organizationId)
    .eq('role', 'client')
    .eq('is_active', true)
  const all = (data ?? []) as { email: string | null; is_org_admin: boolean | null }[]
  const admins = all.filter(c => c.is_org_admin)
  return (admins.length ? admins : all)
    .map(c => c.email)
    .filter((e): e is string => !!e)
}
