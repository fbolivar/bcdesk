import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RustdeskHost } from '@/features/remote/rustdesk-host'

export default async function AgentRemoteControlPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'agent'].includes(profile?.role ?? '')) redirect('/dashboard')

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return <RustdeskHost token={token} clientLink={`${base}/remote/control/${token}`} />
}
