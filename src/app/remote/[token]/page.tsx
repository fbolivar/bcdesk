import { createClient } from '@/lib/supabase/server'
import { RemoteGuest } from '@/features/remote/remote-guest'

export default async function RemoteGuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // Ruta pública: si hay sesión, saludamos por nombre; si no, genérico.
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
    <div style={{ minHeight: '100vh', background: '#F1F4F8' }}>
      <RemoteGuest token={token} visitorName={visitorName} />
    </div>
  )
}
