import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/shared/components/sidebar'
import { NotificationBell } from '@/shared/components/notification-bell'
import { AiAssistant } from '@/features/client/components/ai-assistant'
import { PushSubscribe } from '@/features/client/components/push-subscribe'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, organization_id, organizations(name)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'client') redirect('/dashboard')

  const orgs = profile.organizations as unknown as { name: string }[] | { name: string } | null
  const orgName = Array.isArray(orgs) ? orgs[0]?.name : orgs?.name

  return (
    <div className="flex min-h-screen" style={{ background: '#04080F' }}>
      <Sidebar role="client" userName={profile.full_name} orgName={orgName} />
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-14 flex items-center justify-end px-6 gap-3 shrink-0"
          style={{
            background: 'rgba(8,14,26,0.8)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <PushSubscribe />
          <NotificationBell userId={user.id} />
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
      <AiAssistant />
    </div>
  )
}
