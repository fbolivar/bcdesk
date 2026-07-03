import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Radar, Plus, Trash2, Server } from 'lucide-react'
import { CopyButton } from '@/shared/components/copy-button'
import { DiscoveryAgent } from '@/features/admin/components/discovery-agent'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function DiscoveryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const [{ data: tokens }, { data: discovered }] = await Promise.all([
    supabase.from('org_api_tokens').select('id, name, token, is_active, last_used_at').order('created_at', { ascending: false }),
    supabase.from('assets').select('id, name, asset_type, metadata, last_seen_at').eq('source', 'discovery').order('last_seen_at', { ascending: false }).limit(50),
  ])

  const tokenList = tokens ?? []
  const activeToken = tokenList.find(t => t.is_active)?.token ?? null

  async function createToken(formData: FormData) {
    'use server'
    const sb = await (await import('@/lib/supabase/server')).createClient()
    await sb.from('org_api_tokens').insert({ name: (formData.get('name') as string) || 'Agente de descubrimiento' })
    revalidatePath('/admin/settings/discovery')
  }
  async function deleteToken(id: string) {
    'use server'
    const sb = await (await import('@/lib/supabase/server')).createClient()
    await sb.from('org_api_tokens').delete().eq('id', id)
    revalidatePath('/admin/settings/discovery')
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9] flex items-center gap-2">
          <Radar size={18} className="text-[#3B82F6]" /> Auto-descubrimiento CMDB
        </h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">
          Despliega el agente en tus endpoints para poblar la CMDB automáticamente (hardware + software instalado).
        </p>
      </div>

      {/* Tokens */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#F1F5F9]">Tokens de API</h2>
        <form action={createToken} className="flex gap-3">
          <input name="name" placeholder="Nombre del token (ej: Agente sede Bogotá)"
            className="flex-1 px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#64748B]" />
          <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
            <Plus size={14} /> Generar token
          </button>
        </form>
        {tokenList.length === 0 && <p className="text-xs text-[#64748B]">Sin tokens. Genera uno para el agente.</p>}
        {tokenList.map(t => (
          <div key={t.id} className="flex items-center gap-3 px-3 py-2 bg-[#0F172A] rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#F1F5F9]">{t.name}</p>
              <p className="text-[10px] text-[#475569] font-mono truncate">{t.token?.substring(0, 20)}…</p>
            </div>
            {!t.is_active && <span className="text-[10px] text-[#F59E0B]">inactivo</span>}
            <CopyButton text={t.token} />
            <form action={deleteToken.bind(null, t.id)}>
              <button type="submit" className="p-1.5 rounded-lg text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                <Trash2 size={14} />
              </button>
            </form>
          </div>
        ))}
      </div>

      {/* Agent script */}
      <DiscoveryAgent appUrl={appUrl} token={activeToken} />

      {/* Discovered assets */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#334155] flex items-center gap-2">
          <Server size={15} className="text-[#3B82F6]" />
          <h2 className="text-sm font-semibold text-[#F1F5F9]">Activos descubiertos ({(discovered ?? []).length})</h2>
        </div>
        {(discovered ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm text-[#64748B] text-center">Aún no hay activos descubiertos. Ejecuta el agente en un endpoint.</p>
        )}
        {(discovered ?? []).map(a => {
          const meta = (a.metadata ?? {}) as Record<string, unknown>
          return (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#334155]/50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#F1F5F9]">{a.name}</p>
                <p className="text-xs text-[#64748B]">{(meta.os as string) || a.asset_type} · {(meta.ip as string) || 'sin IP'}</p>
              </div>
              {Array.isArray(meta.software) && (
                <span className="text-[10px] text-[#94A3B8]">{(meta.software as unknown[]).length} apps</span>
              )}
              {a.last_seen_at && (
                <span className="text-[10px] text-[#475569]">
                  visto {formatDistanceToNow(new Date(a.last_seen_at), { locale: es, addSuffix: true })}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
