import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildVisitReportPdf } from '@/lib/visits/build-report'

export const runtime = 'nodejs'

/** Devuelve el acta de la visita como PDF real (documento A4 profesional), no una
 *  captura de pantalla de la app. Se abre en el visor del navegador para revisar,
 *  imprimir o guardar y entregar al cliente. Solo staff (admin/agente). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['admin', 'agent'].includes(me.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let built
  try {
    built = await buildVisitReportPdf(supabase, id)
  } catch (e) {
    return NextResponse.json({ error: `No se pudo generar el PDF: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
  if (!built) return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 })

  return new NextResponse(built.pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      // inline → se abre en el visor del navegador (revisar/imprimir/guardar).
      'Content-Disposition': `inline; filename="acta_${built.visit.visit_number}.pdf"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
