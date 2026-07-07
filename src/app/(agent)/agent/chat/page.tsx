import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { ChatInbox } from '@/features/agent/components/chat-inbox'

export default async function AgentChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!myProfile || !['admin','agent'].includes(myProfile.role)) redirect('/dashboard')

  const { data: sessions } = await supabase
    .from('chat_sessions')
    .select('*, chat_messages(id, content, sender_type, created_at)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle size={18} className="text-[#1789FC]" />
        <h1 className="text-xl font-semibold text-[#0B2545]">Chat en vivo</h1>
        <span className="px-2 py-0.5 rounded-full text-xs bg-[#10B981]/20 text-[#10B981] font-medium">
          {(sessions ?? []).filter(s => s.status === 'waiting').length} esperando
        </span>
      </div>
      <ChatInbox sessions={sessions ?? []} agentId={user.id} agentName={myProfile.full_name ?? 'Agente'} />
    </div>
  )
}
