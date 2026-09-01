import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { query } = await req.json()
  if (!query || query.trim().length < 3) {
    return NextResponse.json({ articles: [] })
  }

  const supabase = await createClient()
  // Requiere sesión: aunque solo lee la base de conocimiento publicada, no debe ser
  // un endpoint abierto a internet (evita abuso/enumeración anónima).
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ articles: [] }, { status: 401 })

  // Sanear el término: evita inyección de filtros PostgREST vía .or()
  const term = String(query).slice(0, 60).replace(/[,().:*%\\]/g, ' ').trim()
  if (term.length < 3) {
    return NextResponse.json({ articles: [] })
  }

  // Full-text search on KB articles
  const { data: articles } = await supabase
    .from('kb_articles')
    .select('id, title, slug, category, content')
    .eq('is_published', true)
    .or(`title.ilike.%${term}%,content.ilike.%${term}%`)
    .limit(4)

  const results = (articles ?? []).map(a => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    category: a.category,
    excerpt: a.content?.substring(0, 120) + '…',
  }))

  return NextResponse.json({ articles: results })
}
