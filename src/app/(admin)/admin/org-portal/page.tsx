import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, Ticket, Users, TrendingUp } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-[#1789FC]/20 text-[#1789FC]',
  in_progress: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  resolved: 'bg-[#10B981]/20 text-[#10B981]',
  closed: 'bg-[#E6EBF2] text-[#5B6B7C]',
}

export default async function OrgPortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: orgs } = await supabase
    .from('organizations')
    .select('*, profiles(count), tickets(count)')
    .eq('status', 'active')
    .order('name')

  const orgList = orgs ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Portal de organizaciones</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Vista consolidada de todas las organizaciones cliente</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {orgList.map((org: any) => (
          <div key={org.id} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E6EBF2] flex items-center justify-center text-[#0B2545] font-bold">
                  {org.name.charAt(0)}
                </div>
                <div>
                  <h2 className="font-semibold text-[#0B2545]">{org.name}</h2>
                  {org.website && <p className="text-xs text-[#5B6B7C]">{org.website}</p>}
                </div>
              </div>
              <Link href={`/admin/org-portal/${org.id}`}
                className="px-3 py-1.5 rounded-lg bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#0B2545] text-xs transition-colors">
                Ver detalle
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="bg-[#F4F7FB] rounded-lg p-3 flex items-center gap-2">
                <Ticket size={14} className="text-[#1789FC]" />
                <div>
                  <p className="text-xs text-[#5B6B7C]">Tickets</p>
                  <p className="font-semibold text-[#0B2545]">{org.tickets?.[0]?.count ?? 0}</p>
                </div>
              </div>
              <div className="bg-[#F4F7FB] rounded-lg p-3 flex items-center gap-2">
                <Users size={14} className="text-[#10B981]" />
                <div>
                  <p className="text-xs text-[#5B6B7C]">Usuarios</p>
                  <p className="font-semibold text-[#0B2545]">{org.profiles?.[0]?.count ?? 0}</p>
                </div>
              </div>
              <div className="bg-[#F4F7FB] rounded-lg p-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-[#F59E0B]" />
                <div>
                  <p className="text-xs text-[#5B6B7C]">Estado</p>
                  <p className="text-xs font-medium text-[#10B981]">Activa</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {orgList.length === 0 && (
          <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
            <Building2 size={32} className="text-[#E6EBF2] mx-auto mb-3" />
            <p className="text-[#5B6B7C] text-sm">Sin organizaciones activas.</p>
          </div>
        )}
      </div>
    </div>
  )
}
