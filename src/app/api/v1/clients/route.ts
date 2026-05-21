import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

function validateApiKey(req: NextRequest): boolean {
  const key = req.headers.get('x-api-key')
  return Boolean(key && key.trim().length > 0)
}

export async function GET(req: NextRequest) {
  if (!validateApiKey(req)) {
    return Response.json(
      { error: 'No autorizado. Incluye el header x-api-key con tu clave API.' },
      { status: 401 }
    )
  }

  const supabase = createServiceClient()

  const { data: clients, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at')
    .eq('role', 'client')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: 'Error al obtener clientes.' }, { status: 500 })
  }

  return Response.json({
    data: clients,
    meta: { count: clients?.length ?? 0 },
  })
}
