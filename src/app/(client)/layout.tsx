import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar, SidebarTrigger } from '@/shared/components/sidebar'
import { NotificationBell } from '@/shared/components/notification-bell'
import { AiAssistant } from '@/features/client/components/ai-assistant'
import { PushSubscribe } from '@/features/client/components/push-subscribe'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, organization_id, organizations(name, rmm_enabled), is_active, token_version')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/logout')
  if (!profile.is_active) redirect('/logout') // usuario desactivado → cerrar sesión
  if (((user.user_metadata as { token_version?: number })?.token_version ?? 0) !== profile.token_version) redirect('/logout')
  if (profile.role !== 'client') redirect('/dashboard')

  const orgs = profile.organizations as unknown as { name: string; rmm_enabled?: boolean }[] | { name: string; rmm_enabled?: boolean } | null
  const org = Array.isArray(orgs) ? orgs[0] : orgs
  const orgName = org?.name
  const rmmEnabled = !!org?.rmm_enabled

  return (
    <div className="min-h-screen p-3 md:p-4" style={{ background: '#F1F4F8' }}>
      <div
        className="flex rounded-2xl overflow-hidden"
        style={{ border: '1px solid #E6EBF2', boxShadow: '0 1px 3px rgba(16,24,40,0.04)', minHeight: 'calc(100vh - 2rem)' }}
      >
        <Sidebar role="client" userName={profile.full_name} orgName={orgName} rmmEnabled={rmmEnabled} />
        <div className="flex-1 flex flex-col min-w-0" style={{ background: '#F7F9FC' }}>
          <header
            className="h-14 flex items-center justify-between px-4 md:px-6 gap-3 shrink-0"
            style={{ background: '#FFFFFF', borderBottom: '1px solid #E6EBF2' }}
          >
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center gap-3 ml-auto">
              <PushSubscribe />
              <NotificationBell userId={user.id} />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      <AiAssistant />
    </div>
  )
}
