import { createClient } from '@/lib/supabase/server'
import { RustdeskGuest } from '@/features/remote/rustdesk-guest'

export default async function RemoteControlGuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let visitorName = ''
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      visitorName = profile?.full_name ?? ''
    }
  } catch { /* invitado sin sesión */ }

  return (
    <div style={{ minHeight: '100vh', background: '#EEF1F6' }}>
      <RustdeskGuest token={token} visitorName={visitorName} />
    </div>
  )
}
