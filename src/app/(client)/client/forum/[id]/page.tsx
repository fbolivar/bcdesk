import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, MessageCircle, Pin, CheckCircle2 } from 'lucide-react'
import { VoteButton } from '@/features/forum/components/vote-button'
import { AcceptReplyButton } from '@/features/forum/components/accept-reply-button'
import { ReplyForm } from '@/features/forum/components/reply-form'
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

interface ReplyWithAuthor {
  id: string
  body: string
  is_accepted: boolean
  upvotes: number
  created_at: string
  author: { id: string; full_name: string } | null
  hasVoted: boolean
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ForumPostPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch post
  const { data: postRaw } = await supabase
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
      author_id,
      profiles!author_id(id, full_name)
    `)
    .eq('id', id)
    .single()

  if (!postRaw) notFound()

  // Increment views
  await supabase
    .from('forum_posts')
    .update({ views: postRaw.views + 1 })
    .eq('id', id)

  // Fetch replies with their authors
  const { data: repliesRaw } = await supabase
    .from('forum_replies')
    .select(`
      id,
      body,
      is_accepted,
      upvotes,
      created_at,
      author_id,
      profiles!author_id(id, full_name)
    `)
    .eq('post_id', id)
    .order('is_accepted', { ascending: false })
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: true })

  // Fetch current user votes for these replies
  const replyIds = (repliesRaw ?? []).map(r => r.id)
  const { data: userVotes } = replyIds.length > 0
    ? await supabase
        .from('forum_votes')
        .select('reply_id')
        .eq('user_id', user.id)
        .in('reply_id', replyIds)
    : { data: [] }

  const votedReplyIds = new Set((userVotes ?? []).map(v => v.reply_id))

  // Normalize post author
  const postProfileData = postRaw.profiles as unknown
  let postAuthor: { id: string; full_name: string } | null = null
  if (postProfileData && typeof postProfileData === 'object' && 'full_name' in (postProfileData as object)) {
    postAuthor = postProfileData as { id: string; full_name: string }
  }

  // Normalize replies
  const replies: ReplyWithAuthor[] = (repliesRaw ?? []).map(r => {
    const rProfileData = r.profiles as unknown
    let rAuthor: { id: string; full_name: string } | null = null
    if (rProfileData && typeof rProfileData === 'object' && 'full_name' in (rProfileData as object)) {
      rAuthor = rProfileData as { id: string; full_name: string }
    }
    return {
      id: r.id,
      body: r.body,
      is_accepted: r.is_accepted,
      upvotes: r.upvotes,
      created_at: r.created_at,
      author: rAuthor,
      hasVoted: votedReplyIds.has(r.id),
    }
  })

  const category = postRaw.category as ForumCategory
  const catColor = CATEGORY_COLORS[category]
  const isPostAuthor = postRaw.author_id === user.id

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <Link
        href="/client/forum"
        className="inline-flex items-center gap-2 text-sm transition-colors"
        style={{ color: '#5B6B7C' }}
      >
        <ArrowLeft size={15} />
        Volver a Comunidad
      </Link>

      {/* Post */}
      <div
        className="rounded-2xl p-6"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: catColor.bg, color: catColor.color }}
          >
            {CATEGORY_LABELS[category]}
          </span>

          {postRaw.is_pinned && (
            <span
              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}
            >
              <Pin size={10} />
              Fijado
            </span>
          )}

          {postRaw.is_answered && (
            <span
              className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(16,217,138,0.12)', color: '#10D98A' }}
            >
              <CheckCircle2 size={10} />
              Respondida
            </span>
          )}
        </div>

        <h1 className="text-lg font-semibold mb-3" style={{ color: '#0B2545' }}>
          {postRaw.title}
        </h1>

        <p className="text-sm leading-relaxed mb-5" style={{ color: '#5B6B7C', whiteSpace: 'pre-wrap' }}>
          {postRaw.body}
        </p>

        <div className="flex items-center justify-between gap-4 flex-wrap pt-4" style={{ borderTop: '1px solid #E6EBF2' }}>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg,#10D98A,#00D4AA)' }}
            >
              {(postAuthor?.full_name ?? 'U').charAt(0).toUpperCase()}
            </div>
            <span className="text-xs" style={{ color: '#5B6B7C' }}>
              {postAuthor?.full_name ?? 'Usuario'} · {timeAgo(postRaw.created_at)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs" style={{ color: '#5B6B7C' }}>
              <MessageCircle size={13} />
              {replies.length} {replies.length === 1 ? 'respuesta' : 'respuestas'}
            </span>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: '#5B6B7C' }}>
              <Eye size={13} />
              {postRaw.views + 1} vistas
            </span>
          </div>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold" style={{ color: '#5B6B7C' }}>
            {replies.length} {replies.length === 1 ? 'Respuesta' : 'Respuestas'}
          </h2>

          {replies.map(reply => (
            <div
              key={reply.id}
              className="rounded-xl p-4"
              style={{
                background: reply.is_accepted ? 'rgba(16,217,138,0.05)' : '#FFFFFF',
                border: `1px solid ${reply.is_accepted ? 'rgba(16,217,138,0.3)' : '#E6EBF2'}`,
              }}
            >
              {/* Reply author */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg,#00D4AA,#8B6FFF)' }}
                >
                  {(reply.author?.full_name ?? 'U').charAt(0).toUpperCase()}
                </div>
                <span className="text-xs" style={{ color: '#5B6B7C' }}>
                  {reply.author?.full_name ?? 'Usuario'} · {timeAgo(reply.created_at)}
                </span>
              </div>

              {/* Reply body */}
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#5B6B7C', whiteSpace: 'pre-wrap' }}>
                {reply.body}
              </p>

              {/* Footer actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <VoteButton
                  replyId={reply.id}
                  upvotes={reply.upvotes}
                  hasVoted={reply.hasVoted}
                />

                {isPostAuthor && (
                  <AcceptReplyButton
                    replyId={reply.id}
                    postId={id}
                    isAccepted={reply.is_accepted}
                  />
                )}

                {!isPostAuthor && reply.is_accepted && (
                  <span
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                    style={{ background: 'rgba(16,217,138,0.15)', color: '#10D98A' }}
                  >
                    <CheckCircle2 size={12} />
                    Aceptada
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: '#0B2545' }}>
          Tu respuesta
        </h2>
        <ReplyForm postId={id} />
      </div>
    </div>
  )
}
