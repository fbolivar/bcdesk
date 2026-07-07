import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientChatWindow } from '@/features/chat/components/client-chat-window'

export default async function ClientChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, organization_id')
    .eq('id', user.id)
    .single()

  // Buscar sesión activa del usuario
  const { data: existingSession } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('visitor_id', user.id)
    .in('status', ['waiting', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold" style={{ color: '#0B2545' }}>Chat en vivo</h1>
        <p className="text-sm mt-0.5" style={{ color: '#5B6B7C' }}>Habla con nuestro equipo en tiempo real</p>
      </div>
      <ClientChatWindow
        userId={user.id}
        userName={profile?.full_name ?? 'Usuario'}
        userEmail={profile?.email ?? ''}
        organizationId={profile?.organization_id ?? null}
        initialSession={existingSession ?? null}
      />
    </div>
  )
}
