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
    <div className="min-h-screen p-3 md:p-4" style={{ background: '#EEF1F6' }}>
      <div
        className="flex rounded-2xl overflow-hidden"
        style={{ border: '1px solid #E6EBF2', boxShadow: '0 1px 3px rgba(16,24,40,0.04)', minHeight: 'calc(100vh - 2rem)' }}
      >
        <Sidebar role="client" userName={profile.full_name} orgName={orgName} />
        <div className="flex-1 flex flex-col min-w-0" style={{ background: '#F7F9FC' }}>
          <header
            className="h-14 flex items-center justify-end px-6 gap-3 shrink-0"
            style={{ background: '#FFFFFF', borderBottom: '1px solid #E6EBF2' }}
          >
            <PushSubscribe />
            <NotificationBell userId={user.id} />
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <AiAssistant />
    </div>
  )
}
