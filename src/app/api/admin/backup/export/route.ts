import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildBackup } from '@/features/admin/services/backup'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  void req
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const stamp = new Date().toISOString().slice(0, 10)
  const { content } = await buildBackup(new Date().toISOString())

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="hexdesk-respaldo-${stamp}.fbb"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
