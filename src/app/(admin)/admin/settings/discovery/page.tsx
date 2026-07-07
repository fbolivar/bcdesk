import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
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
    supabase.from('org_api_tokens').select('id, name, token_prefix, is_active, last_used_at').order('created_at', { ascending: false }),
    supabase.from('assets').select('id, name, asset_type, metadata, last_seen_at').eq('source', 'discovery').order('last_seen_at', { ascending: false }).limit(50),
  ])

  const tokenList = tokens ?? []
  // El token en claro solo existe al crearlo (se guarda hasheado). El script del
  // agente se muestra con el token recién generado (flash de un solo uso).
  const flashToken = (await cookies()).get('flash_disc_token')?.value ?? null

  async function createToken(formData: FormData) {
    'use server'
    const { createClient } = await import('@/lib/supabase/server')
    const { generateOrgToken, hashOrgToken, tokenPrefix } = await import('@/lib/api/org-token-crypto')
    const { cookies } = await import('next/headers')
    const sb = await createClient()
    const raw = generateOrgToken()
    await sb.from('org_api_tokens').insert({
      name: (formData.get('name') as string) || 'Agente de descubrimiento',
      token_hash: await hashOrgToken(raw),
      token_prefix: tokenPrefix(raw),
    })
    ;(await cookies()).set('flash_disc_token', raw, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/admin/settings/discovery', maxAge: 300,
    })
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
        <h1 className="text-xl font-semibold text-[#0B2545] flex items-center gap-2">
          <Radar size={18} className="text-[#1789FC]" /> Auto-descubrimiento CMDB
        </h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">
          Despliega el agente en tus endpoints para poblar la CMDB automáticamente (hardware + software instalado).
        </p>
      </div>

      {/* Tokens */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#0B2545]">Tokens de API</h2>
        <form action={createToken} className="flex gap-3">
          <input name="name" placeholder="Nombre del token (ej: Agente sede Bogotá)"
            className="flex-1 px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#5B6B7C]" />
          <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
            <Plus size={14} /> Generar token
          </button>
        </form>
        {flashToken && (
          <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid #00D4AA' }}>
            <p className="text-xs text-[#0B2545] mb-1 font-medium">Token generado — cópialo ahora (solo se muestra una vez)</p>
            <CopyButton text={flashToken} />
          </div>
        )}
        {tokenList.length === 0 && <p className="text-xs text-[#5B6B7C]">Sin tokens. Genera uno para el agente.</p>}
        {tokenList.map(t => (
          <div key={t.id} className="flex items-center gap-3 px-3 py-2 bg-[#F4F7FB] rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#0B2545]">{t.name}</p>
              <p className="text-[10px] text-[#CBD5E1] font-mono truncate">{t.token_prefix ? `${t.token_prefix}…` : '—'}</p>
            </div>
            {!t.is_active && <span className="text-[10px] text-[#F59E0B]">inactivo</span>}
            <form action={deleteToken.bind(null, t.id)}>
              <button type="submit" className="p-1.5 rounded-lg text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                <Trash2 size={14} />
              </button>
            </form>
          </div>
        ))}
      </div>

      {/* Agent script — solo con el token recién generado (flash) */}
      <DiscoveryAgent appUrl={appUrl} token={flashToken} />

      {/* Discovered assets */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E6EBF2] flex items-center gap-2">
          <Server size={15} className="text-[#1789FC]" />
          <h2 className="text-sm font-semibold text-[#0B2545]">Activos descubiertos ({(discovered ?? []).length})</h2>
        </div>
        {(discovered ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm text-[#5B6B7C] text-center">Aún no hay activos descubiertos. Ejecuta el agente en un endpoint.</p>
        )}
        {(discovered ?? []).map(a => {
          const meta = (a.metadata ?? {}) as Record<string, unknown>
          return (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#E6EBF2]/50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#0B2545]">{a.name}</p>
                <p className="text-xs text-[#5B6B7C]">{(meta.os as string) || a.asset_type} · {(meta.ip as string) || 'sin IP'}</p>
              </div>
              {Array.isArray(meta.software) && (
                <span className="text-[10px] text-[#5B6B7C]">{(meta.software as unknown[]).length} apps</span>
              )}
              {a.last_seen_at && (
                <span className="text-[10px] text-[#CBD5E1]">
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
