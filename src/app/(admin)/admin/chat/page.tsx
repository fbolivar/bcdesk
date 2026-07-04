import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminChatShell } from '@/features/chat/components/admin-chat-shell'

export default async function AdminChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!['admin', 'agent'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: sessions } = await supabase
    .from('chat_sessions')
    .select('*')
    .in('status', ['waiting', 'active'])
    .order('updated_at', { ascending: false })

  return (
    <AdminChatShell
      agentId={user.id}
      agentName={profile?.full_name ?? 'Agente'}
      initialSessions={sessions ?? []}
    />
  )
}
