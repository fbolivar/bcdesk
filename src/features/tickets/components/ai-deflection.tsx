'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, BookOpen, X } from 'lucide-react'
import Link from 'next/link'

interface Article {
  id: string
  title: string
  slug: string
  category: string
  excerpt: string
}

interface Props {
  value: string
}

export function AiDeflection({ value }: Props) {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setDismissed(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (value.trim().length < 8) { setArticles([]); return }

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/ai/deflect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: value }),
        })
        const data = await res.json()
        setArticles(data.articles ?? [])
      } finally {
        setLoading(false)
      }
    }, 600)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [value])

  if (dismissed || (articles.length === 0 && !loading)) return null

  return (
    <div className="mt-3 bg-[#F4F7FB] border border-[#00D4AA]/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#0E9E86]" />
          <p className="text-xs font-semibold text-[#0E9E86]">
            {loading ? 'Buscando soluciones…' : '¿Ya revisaste estos artículos?'}
          </p>
        </div>
        <button onClick={() => setDismissed(true)}
          className="text-[#CBD5E1] hover:text-[#5B6B7C] transition-colors">
          <X size={12} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-8 bg-[#FFFFFF] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map(a => (
            <Link key={a.id} href={`/client/knowledge/${a.slug}`} target="_blank"
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-[#FFFFFF] transition-colors group">
              <BookOpen size={12} className="text-[#5B6B7C] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-[#0B2545] group-hover:text-[#0E9E86] transition-colors">
                  {a.title}
                </p>
                <p className="text-[10px] text-[#5B6B7C] mt-0.5">{a.excerpt}</p>
              </div>
            </Link>
          ))}
          <p className="text-[10px] text-[#CBD5E1] mt-2 pt-2 border-t border-[#E6EBF2]">
            Si ninguno resuelve tu problema, continúa creando el ticket.
          </p>
        </div>
      )}
    </div>
  )
}
