import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Network, Users, Plus } from 'lucide-react'
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

  const { data: synced } = await supabase.from('profiles').select('id, full_name, email, role, is_active, directory_synced_at')
    .eq('auth_source', 'ldap').order('directory_synced_at', { ascending: false }).limit(100)

  // El token en claro solo se muestra al generarlo (se guarda hasheado).
  const flashToken = (await cookies()).get('flash_dir_token')?.value ?? null
  const syncedList = synced ?? []

  async function generateToken() {
    'use server'
    const { createClient } = await import('@/lib/supabase/server')
    const { generateOrgToken, hashOrgToken, tokenPrefix } = await import('@/lib/api/org-token-crypto')
    const { cookies } = await import('next/headers')
    const sb = await createClient()
    const raw = generateOrgToken()
    await sb.from('org_api_tokens').insert({ name: 'Directorio AD/LDAP', token_hash: await hashOrgToken(raw), token_prefix: tokenPrefix(raw) })
    ;(await cookies()).set('flash_dir_token', raw, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
      path: '/admin/settings/directory', maxAge: 300,
    })
    revalidatePath('/admin/settings/directory')
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545] flex items-center gap-2">
          <Network size={18} className="text-[#1789FC]" /> Sincronización AD / LDAP
        </h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">
          Aprovisiona y desactiva usuarios automáticamente desde tu Active Directory.
        </p>
      </div>

      {!flashToken && (
        <form action={generateToken}>
          <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
            <Plus size={14} /> Generar clave de integración
          </button>
        </form>
      )}
      {flashToken && (
        <p className="text-xs text-[#00A88A]">Clave generada abajo — cópiala ahora, solo se muestra una vez.</p>
      )}

      <DirectorySyncAgent appUrl={appUrl} token={flashToken} />

      {/* Synced users */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E6EBF2] flex items-center gap-2">
          <Users size={15} className="text-[#1789FC]" />
          <h2 className="text-sm font-semibold text-[#0B2545]">Usuarios sincronizados desde el directorio ({syncedList.length})</h2>
        </div>
        {syncedList.length === 0 && (
          <p className="px-4 py-6 text-sm text-[#5B6B7C] text-center">Aún no hay usuarios sincronizados. Ejecuta el script de sincronización.</p>
        )}
        {syncedList.map(p => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#E6EBF2]/50 last:border-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${p.is_active ? 'bg-[#E6EBF2] text-[#0B2545]' : 'bg-[#FFFFFF] border border-[#E6EBF2] text-[#5B6B7C]'}`}>
              {p.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${p.is_active ? 'text-[#0B2545]' : 'text-[#5B6B7C] line-through'}`}>{p.full_name}</p>
              <p className="text-xs text-[#5B6B7C]">{p.email}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E6EBF2] text-[#5B6B7C]">{ROLE_LABEL[p.role] ?? p.role}</span>
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
