import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Network, Users } from 'lucide-react'
import { DirectorySyncAgent } from '@/features/admin/components/directory-sync-agent'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', agent: 'Agente', client: 'Cliente' }

export default async function DirectoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const [{ data: tokens }, { data: synced }] = await Promise.all([
    supabase.from('org_api_tokens').select('token, is_active').eq('is_active', true).limit(1),
    supabase.from('profiles').select('id, full_name, email, role, is_active, directory_synced_at')
      .eq('auth_source', 'ldap').order('directory_synced_at', { ascending: false }).limit(100),
  ])

  const activeToken = tokens?.[0]?.token ?? null
  const syncedList = synced ?? []

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B] flex items-center gap-2">
          <Network size={18} className="text-[#3B82F6]" /> Sincronización AD / LDAP
        </h1>
        <p className="text-sm text-[#64748B] mt-0.5">
          Aprovisiona y desactiva usuarios automáticamente desde tu Active Directory.
        </p>
      </div>

      <DirectorySyncAgent appUrl={appUrl} token={activeToken} />

      {/* Synced users */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E6EBF2] flex items-center gap-2">
          <Users size={15} className="text-[#3B82F6]" />
          <h2 className="text-sm font-semibold text-[#1E293B]">Usuarios sincronizados desde el directorio ({syncedList.length})</h2>
        </div>
        {syncedList.length === 0 && (
          <p className="px-4 py-6 text-sm text-[#64748B] text-center">Aún no hay usuarios sincronizados. Ejecuta el script de sincronización.</p>
        )}
        {syncedList.map(p => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#E6EBF2]/50 last:border-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${p.is_active ? 'bg-[#E6EBF2] text-[#1E293B]' : 'bg-[#FFFFFF] border border-[#E6EBF2] text-[#64748B]'}`}>
              {p.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${p.is_active ? 'text-[#1E293B]' : 'text-[#64748B] line-through'}`}>{p.full_name}</p>
              <p className="text-xs text-[#64748B]">{p.email}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E6EBF2] text-[#64748B]">{ROLE_LABEL[p.role] ?? p.role}</span>
            {!p.is_active && <span className="text-[10px] text-[#EF4444]">inactivo</span>}
            {p.directory_synced_at && (
              <span className="text-[10px] text-[#CBD5E1]">
                {formatDistanceToNow(new Date(p.directory_synced_at), { locale: es, addSuffix: true })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
