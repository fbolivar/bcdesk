import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateOrgToken, unauthorized } from '@/lib/api/org-token'

export async function GET(req: NextRequest) {
  const auth = await validateOrgToken(req)
  if (!auth) return unauthorized()

  const supabase = createServiceClient()
  const { data: clients, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at')
    .eq('role', 'client')
    .eq('is_active', true)
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: 'Error al obtener clientes.' }, { status: 500 })
  return Response.json({ data: clients, meta: { count: clients?.length ?? 0 } })
}
