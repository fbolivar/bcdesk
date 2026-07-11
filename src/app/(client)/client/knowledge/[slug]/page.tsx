import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, ThumbsUp, ThumbsDown, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { revalidatePath } from 'next/cache'

interface Props { params: Promise<{ slug: string }> }

export default async function KbArticlePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: article } = await supabase
    .from('kb_articles')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!article) notFound()

  // View count increment (fire and forget) — kb_articles solo es editable por
  // admin vía RLS, así que el contador se actualiza con service-role.
  createServiceClient().from('kb_articles').update({ views: (article.views ?? 0) + 1 }).eq('id', article.id).then(() => {})

  // Check if user already rated
  const { data: existingRating } = await supabase
    .from('kb_article_ratings')
    .select('rating')
    .eq('article_id', article.id)
    .eq('user_id', user.id)
    .single()

  // Get version history
  const { data: versions } = await supabase
    .from('kb_article_versions')
    .select('version_number, created_at, change_summary')
    .eq('article_id', article.id)
    .order('version_number', { ascending: false })
    .limit(5)

  async function handleRate(helpful: boolean) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('kb_article_ratings').upsert({
      article_id: article.id,
      user_id: user.id,
      rating: helpful,
    }, { onConflict: 'article_id,user_id' })
    // Update counts (kb_articles solo editable por admin vía RLS → service-role)
    const { data: ratings } = await supabase
      .from('kb_article_ratings')
      .select('rating')
      .eq('article_id', article.id)
    const helpful_count = ratings?.filter(r => r.rating).length ?? 0
    const not_helpful_count = ratings?.filter(r => !r.rating).length ?? 0
    await createServiceClient().from('kb_articles').update({ helpful_count, not_helpful_count }).eq('id', article.id)
    revalidatePath(`/client/knowledge/${slug}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/client/knowledge" className="inline-flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">
        <ArrowLeft size={14} /> Base de conocimiento
      </Link>

      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-6">
        <div className="mb-6">
          {article.category && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-[#E6EBF2] text-[#5B6B7C] mb-3 inline-block">
              {article.category}
            </span>
          )}
          <h1 className="text-xl font-bold text-[#0B2545]">{article.title}</h1>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-[#5B6B7C]">
              {format(new Date(article.created_at), "d 'de' MMMM yyyy", { locale: es })}
            </span>
            <span className="flex items-center gap-1 text-xs text-[#5B6B7C]">
              <Eye size={12} /> {article.views ?? 0} visitas
            </span>
            {article.current_version && (
              <span className="flex items-center gap-1 text-xs text-[#5B6B7C]">
                <Clock size={12} /> v{article.current_version}
              </span>
            )}
          </div>
        </div>

        <div className="prose prose-sm max-w-none">
          {article.content.split('\n').map((line: string, i: number) => (
            line.trim() === ''
              ? <br key={i} />
              : <p key={i} className="text-[#5B6B7C] mb-2 leading-relaxed">{line}</p>
          ))}
        </div>

        {/* Ratings */}
        <div className="mt-6 pt-5 border-t border-[#E6EBF2]">
          <p className="text-sm text-[#5B6B7C] mb-3">¿Fue útil este artículo?</p>
          {existingRating ? (
            <p className="text-xs text-[#10B981]">
              {existingRating.rating ? '👍 Marcaste esto como útil' : '👎 Marcaste esto como no útil'}
            </p>
          ) : (
            <div className="flex gap-3">
              <form action={handleRate.bind(null, true)}>
                <button type="submit"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6EBF2] text-xs text-[#5B6B7C] hover:border-[#10B981] hover:text-[#10B981] transition-colors">
                  <ThumbsUp size={13} /> Sí, fue útil ({article.helpful_count ?? 0})
                </button>
              </form>
              <form action={handleRate.bind(null, false)}>
                <button type="submit"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6EBF2] text-xs text-[#5B6B7C] hover:border-[#EF4444] hover:text-[#EF4444] transition-colors">
                  <ThumbsDown size={13} /> No ({article.not_helpful_count ?? 0})
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Version history */}
      {versions && versions.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-3 flex items-center gap-2">
            <Clock size={13} /> Historial de versiones
          </h2>
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.version_number} className="flex items-center gap-3 text-xs">
                <span className="text-[#0E9E86] font-mono">v{v.version_number}</span>
                <span className="text-[#5B6B7C]">{new Date(v.created_at).toLocaleDateString('es-CO')}</span>
                <span className="text-[#5B6B7C]">{v.change_summary ?? 'Sin descripción'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center py-4">
        <p className="text-sm text-[#5B6B7C]">¿No encontraste lo que buscabas?</p>
        <Link href="/client/tickets/new"
          className="inline-block mt-2 px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors">
          Abrir un ticket de soporte
        </Link>
      </div>
    </div>
  )
}
