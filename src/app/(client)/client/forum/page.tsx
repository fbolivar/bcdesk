import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, Pin, CheckCircle2, Eye, MessageCircle } from 'lucide-react'
import { NewPostButton } from '@/features/forum/components/new-post-button'
import { CATEGORY_LABELS, CATEGORY_COLORS, type ForumCategory } from '@/features/forum/types/forum.types'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days}d`
  const months = Math.floor(days / 30)
  return `hace ${months} mes${months > 1 ? 'es' : ''}`
}

interface PostWithMeta {
  id: string
  title: string
  body: string
  category: ForumCategory
  is_answered: boolean
  is_pinned: boolean
  views: number
  created_at: string
  profiles: { full_name: string } | null
  reply_count: number
}

export default async function ForumPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawPosts } = await supabase
    .from('forum_posts')
    .select(`
      id,
      title,
      body,
      category,
      is_answered,
      is_pinned,
      views,
      created_at,
      profiles!author_id(full_name),
      forum_replies(id)
    `)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  const posts: PostWithMeta[] = (rawPosts ?? []).map((p) => {
    const profileData = p.profiles as unknown
    let profileObj: { full_name: string } | null = null
    if (profileData && typeof profileData === 'object' && 'full_name' in (profileData as object)) {
      profileObj = profileData as { full_name: string }
    }
    const repliesData = p.forum_replies as unknown
    const replyCount = Array.isArray(repliesData) ? repliesData.length : 0
    return {
      id: p.id,
      title: p.title,
      body: p.body,
      category: p.category as ForumCategory,
      is_answered: p.is_answered,
      is_pinned: p.is_pinned,
      views: p.views,
      created_at: p.created_at,
      profiles: profileObj,
      reply_count: replyCount,
    }
  })

  const totalPosts = posts.length
  const answeredPosts = posts.filter(p => p.is_answered).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(23,137,252,0.15)' }}
            >
              <MessageSquare size={18} style={{ color: '#1789FC' }} />
            </div>
            <h1 className="text-xl font-semibold" style={{ color: '#0B2545' }}>Comunidad</h1>
          </div>
          <p className="text-sm ml-11.5" style={{ color: '#5B6B7C' }}>
            {totalPosts} {totalPosts === 1 ? 'pregunta' : 'preguntas'} · {answeredPosts} respondidas
          </p>
        </div>
        <NewPostButton />
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
        >
          <MessageSquare size={40} className="mx-auto mb-4" style={{ color: '#E6EBF2' }} />
          <h3 className="text-base font-semibold mb-1" style={{ color: '#0B2545' }}>Aún no hay publicaciones</h3>
          <p className="text-sm mb-4" style={{ color: '#5B6B7C' }}>Sé el primero en hacer una pregunta o compartir un tip</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => {
            const catColor = CATEGORY_COLORS[post.category]
            const excerpt = post.body.length > 120 ? post.body.slice(0, 120) + '...' : post.body

            return (
              <div
                key={post.id}
                className="rounded-xl p-4 transition-all group"
                style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
              >
                {/* Top row */}
                <div className="flex flex-wrap items-center gap-2 mb-2.5">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: catColor.bg, color: catColor.color }}
                  >
                    {CATEGORY_LABELS[post.category]}
                  </span>

                  {post.is_pinned && (
                    <span
                      className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}
                    >
                      <Pin size={10} />
                      Fijado
                    </span>
                  )}

                  {post.is_answered && (
                    <span
                      className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(16,217,138,0.12)', color: '#10D98A' }}
                    >
                      <CheckCircle2 size={10} />
                      Respondida
                    </span>
                  )}
                </div>

                {/* Title */}
                <Link
                  href={`/client/forum/${post.id}`}
                  className="block text-sm font-semibold mb-1.5 transition-colors group-hover:text-[#1789FC]"
                  style={{ color: '#0B2545' }}
                >
                  {post.title}
                </Link>

                {/* Excerpt */}
                <p className="text-xs leading-relaxed mb-3" style={{ color: '#5B6B7C' }}>
                  {excerpt}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ background: 'linear-gradient(135deg,#10D98A,#00D4AA)' }}
                    >
                      {(post.profiles?.full_name ?? 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs" style={{ color: '#5B6B7C' }}>
                      {post.profiles?.full_name ?? 'Usuario'} · {timeAgo(post.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: '#5B6B7C' }}>
                      <MessageCircle size={13} />
                      {post.reply_count} {post.reply_count === 1 ? 'respuesta' : 'respuestas'}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: '#5B6B7C' }}>
                      <Eye size={13} />
                      {post.views} vistas
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
