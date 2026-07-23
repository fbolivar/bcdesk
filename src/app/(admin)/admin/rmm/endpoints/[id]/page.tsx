import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EndpointDetail } from '@/features/rmm/endpoint-detail'

export const dynamic = 'force-dynamic'

export default async function RmmEndpointPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="space-y-4">
      <Link href="/admin/clients" className="inline-flex items-center gap-1 text-xs text-[#5B6B7C] hover:text-[#0B2545]">
        <ArrowLeft size={13} /> Clientes
      </Link>
      <EndpointDetail endpointId={id} />
    </div>
  )
}
