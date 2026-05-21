import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/shared/components/sidebar'
import { NotificationBell } from '@/shared/components/notification-bell'
import { Toaster } from '@/shared/components/toaster'
import { RealtimeTickets } from '@/shared/components/realtime-tickets'

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'agent'].includes(profile.role)) redirect('/dashboard')

  return (
    <div className="flex min-h-screen" style={{ background: '#04080F' }}>
      <Sidebar role="agent" userName={profile.full_name} />
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-14 flex items-center justify-end px-6 gap-3 shrink-0"
          style={{
            background: 'rgba(8,14,26,0.8)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <NotificationBell userId={user.id} />
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
      <Toaster />
      <RealtimeTickets role="agent" userId={user.id} />
    </div>
  )
}
