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
    .select('role, full_name, organization_id, organizations(name), is_active, token_version')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/logout')
  if (!profile.is_active) redirect('/logout') // usuario desactivado → cerrar sesión
  if (((user.user_metadata as { token_version?: number })?.token_version ?? 0) !== profile.token_version) redirect('/logout')
  if (profile.role !== 'client') redirect('/dashboard')

  const orgs = profile.organizations as unknown as { name: string }[] | { name: string } | null
  const orgName = Array.isArray(orgs) ? orgs[0]?.name : orgs?.name

  return (
    <div className="min-h-screen p-3 md:p-4" style={{ background: '#F1F4F8' }}>
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
