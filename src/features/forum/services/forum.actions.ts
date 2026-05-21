'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createForumPost(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No auth')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const title = formData.get('title') as string
  const body = formData.get('body') as string
  const category = formData.get('category') as string

  const { error } = await supabase.from('forum_posts').insert({
    title,
    body,
    category,
    author_id: user.id,
    organization_id: profile?.organization_id,
  })

  if (error) throw error
  revalidatePath('/client/forum')
}

export async function createForumReply(postId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No auth')

  const body = formData.get('body') as string

  const { error } = await supabase.from('forum_replies').insert({
    post_id: postId,
    author_id: user.id,
    body,
  })

  if (error) throw error
  revalidatePath(`/client/forum/${postId}`)
}

export async function toggleVote(replyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No auth')

  const { data: existing } = await supabase
    .from('forum_votes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('reply_id', replyId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('forum_votes')
      .delete()
      .eq('user_id', user.id)
      .eq('reply_id', replyId)
    await supabase.rpc('decrement_upvotes', { reply_id: replyId })
  } else {
    await supabase.from('forum_votes').insert({ user_id: user.id, reply_id: replyId })
    await supabase.rpc('increment_upvotes', { reply_id: replyId })
  }

  revalidatePath('/client/forum')
}

export async function markAccepted(replyId: string, postId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No auth')

  // Desmarcar todas las replies del post
  await supabase
    .from('forum_replies')
    .update({ is_accepted: false })
    .eq('post_id', postId)

  // Marcar esta como aceptada
  await supabase
    .from('forum_replies')
    .update({ is_accepted: true })
    .eq('id', replyId)

  await supabase
    .from('forum_posts')
    .update({ is_answered: true })
    .eq('id', postId)

  revalidatePath(`/client/forum/${postId}`)
}
