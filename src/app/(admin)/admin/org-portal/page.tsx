import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, Ticket, Users, TrendingUp } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-[#3B82F6]/20 text-[#3B82F6]',
  in_progress: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  resolved: 'bg-[#10B981]/20 text-[#10B981]',
  closed: 'bg-[#E6EBF2] text-[#64748B]',
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
    .eq('is_active', true)
    .order('name')

  const orgList = orgs ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Portal de organizaciones</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Vista consolidada de todas las organizaciones cliente</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {orgList.map((org: any) => (
          <div key={org.id} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E6EBF2] flex items-center justify-center text-[#1E293B] font-bold">
                  {org.name.charAt(0)}
                </div>
                <div>
                  <h2 className="font-semibold text-[#1E293B]">{org.name}</h2>
                  {org.domain && <p className="text-xs text-[#64748B]">{org.domain}</p>}
                </div>
              </div>
              <Link href={`/admin/org-portal/${org.id}`}
                className="px-3 py-1.5 rounded-lg bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#1E293B] text-xs transition-colors">
                Ver detalle
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#F4F7FB] rounded-lg p-3 flex items-center gap-2">
                <Ticket size={14} className="text-[#3B82F6]" />
                <div>
                  <p className="text-xs text-[#64748B]">Tickets</p>
                  <p className="font-semibold text-[#1E293B]">{org.tickets?.[0]?.count ?? 0}</p>
                </div>
              </div>
              <div className="bg-[#F4F7FB] rounded-lg p-3 flex items-center gap-2">
                <Users size={14} className="text-[#10B981]" />
                <div>
                  <p className="text-xs text-[#64748B]">Usuarios</p>
                  <p className="font-semibold text-[#1E293B]">{org.profiles?.[0]?.count ?? 0}</p>
                </div>
              </div>
              <div className="bg-[#F4F7FB] rounded-lg p-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-[#F59E0B]" />
                <div>
                  <p className="text-xs text-[#64748B]">Estado</p>
                  <p className="text-xs font-medium text-[#10B981]">Activa</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {orgList.length === 0 && (
          <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
            <Building2 size={32} className="text-[#E6EBF2] mx-auto mb-3" />
            <p className="text-[#64748B] text-sm">Sin organizaciones activas.</p>
          </div>
        )}
      </div>
    </div>
  )
}
