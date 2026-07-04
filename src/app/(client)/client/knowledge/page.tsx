import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BookOpen, Search } from 'lucide-react'
import Link from 'next/link'

interface Props { searchParams: Promise<{ q?: string; cat?: string }> }

function highlight(text: string, term: string): string {
  if (!term) return text
  return text.replace(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '**$1**')
}

function HighlightedText({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase()
          ? <mark key={i} className="bg-[#4F8AFF]/25 text-[#4F8AFF] rounded px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

export default async function ClientKnowledgePage({ searchParams }: Props) {
  const { q, cat } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let query = supabase
    .from('kb_articles')
    .select('id, title, slug, category, views, created_at')
    .eq('is_published', true)
    .order('views', { ascending: false })

  if (q) {
    query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`)
  }

  if (!q && cat) {
    query = query.eq('category', cat)
  }

  const { data: articles } = await query
  const list = articles ?? []

  const allCategories = Array.from(new Set((articles ?? []).map(a => a.category).filter(Boolean))) as string[]

  const byCategory: Record<string, typeof list> = {}
  for (const a of list) {
    const c = a.category ?? 'General'
    if (!byCategory[c]) byCategory[c] = []
    byCategory[c].push(a)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0F172A]">Base de conocimiento</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Encuentra respuestas a tus preguntas</p>
      </div>

      <form method="GET">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar en la base de conocimiento..."
            className="w-full pl-10 pr-4 py-3 rounded-xl text-[#0F172A] text-sm focus:outline-none placeholder-[#64748B]"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E6EBF2',
            }}
            autoComplete="off"
          />
        </div>
      </form>

      {!q && allCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/client/knowledge"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !cat ? 'bg-[#4F8AFF] text-white' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
            style={!cat ? {} : { background: '#F4F7FB', border: '1px solid #E6EBF2' }}
          >
            Todas
          </Link>
          {allCategories.map(c => (
            <Link
              key={c}
              href={`/client/knowledge?cat=${encodeURIComponent(c)}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                cat === c ? 'bg-[#4F8AFF] text-white' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
              style={cat === c ? {} : { background: '#F4F7FB', border: '1px solid #E6EBF2' }}
            >
              {c}
            </Link>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div
          className="rounded-2xl p-16 flex flex-col items-center justify-center text-center"
          style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
        >
          <BookOpen size={40} className="text-[#64748B] mb-3" />
          <p className="text-[#0F172A] font-medium">
            {q ? 'Sin resultados para esta búsqueda' : 'Sin artículos disponibles'}
          </p>
          {q && <p className="text-sm text-[#64748B] mt-1">Intenta con otras palabras clave</p>}
        </div>
      ) : q ? (
        <div className="space-y-3">
          <p className="text-xs text-[#64748B]">
            {list.length} artículo{list.length !== 1 ? 's' : ''} encontrado{list.length !== 1 ? 's' : ''} para &ldquo;{q}&rdquo;
          </p>
          {list.map(a => (
            <Link
              key={a.id}
              href={`/client/knowledge/${a.slug}`}
              className="block rounded-2xl p-4 hover:border-[#4F8AFF]/50 transition-all"
              style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
            >
              <p className="text-sm font-medium text-[#0F172A]">
                <HighlightedText text={a.title} term={q} />
              </p>
              {a.category && (
                <span
                  className="text-xs mt-1.5 inline-block px-2 py-0.5 rounded-full font-medium"
                  style={{ color: '#4F8AFF', background: 'rgba(79,138,255,0.12)' }}
                >
                  {a.category}
                </span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        Object.entries(byCategory).map(([catName, arts]) => (
          <div key={catName}>
            <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">{catName}</h2>
            <div className="space-y-2">
              {arts.map(a => (
                <Link
                  key={a.id}
                  href={`/client/knowledge/${a.slug}`}
                  className="flex items-center justify-between rounded-2xl p-4 hover:border-[#4F8AFF]/50 transition-all group"
                  style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
                >
                  <p className="text-sm font-medium text-[#0F172A] group-hover:text-[#4F8AFF] transition-colors">
                    {a.title}
                  </p>
                  <span className="text-xs text-[#64748B] shrink-0 ml-4">{a.views ?? 0} visitas</span>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
