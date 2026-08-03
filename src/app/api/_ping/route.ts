import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Marcador temporal para verificar QUÉ commit sirve el dominio de producción.
export async function GET() {
  return NextResponse.json({ marker: 'menu-fix-f618798', ok: true })
}
