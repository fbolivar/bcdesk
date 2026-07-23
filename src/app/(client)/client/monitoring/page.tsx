import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Monitor, ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const OFFLINE_MS = 10 * 60 * 1000

function rel(iso: string | null): string {
  if (!iso) return 'nunca'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'hace segundos'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} d`
}

export default async function ClientMonitoringPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS: solo devuelve endpoints activos de la organización del cliente, y solo
  // columnas seguras (sin token ni machine_id — bloqueadas por GRANT de columna).
  const { data: endpoints } = await supabase
    .from('endpoints')
    .select('id, hostname, os, status, last_seen_at, agent_version, created_at')
    .order('hostname', { ascending: true })

  const eps = endpoints ?? []
  const now = Date.now()
  const list = eps.map(e => ({
    ...e,
    online: !!e.last_seen_at && now - new Date(e.last_seen_at).getTime() < OFFLINE_MS,
  }))
  const onlineCount = list.filter(e => e.online).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Mis equipos monitoreados</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">
          {list.length === 0 ? 'Sin equipos monitoreados todavía.' : `${list.length} equipos · ${onlineCount} en línea ahora`}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="bg-white border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Monitor size={28} className="mx-auto text-[#CBD5E1]" />
          <p className="text-[#5B6B7C] mt-3">Aún no hay equipos monitoreados para tu organización.</p>
          <p className="text-xs text-[#94A3B8] mt-1">Cuando tu proveedor instale el agente de monitoreo, tus equipos aparecerán aquí.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map(e => (
            <Link key={e.id} href={`/client/monitoring/${e.id}`}
              className="flex items-center gap-3 bg-white border border-[#E6EBF2] rounded-xl px-4 py-3 hover:border-[#00D4AA] transition-colors">
              <Monitor size={18} className="text-[#0E9E86] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#0B2545] truncate">{e.hostname ?? '(sin nombre)'}</p>
                <p className="text-[11px] text-[#94A3B8]">{e.os ?? '—'} · visto {rel(e.last_seen_at)}</p>
              </div>
              {e.online ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#10B981]"><span className="w-2 h-2 rounded-full bg-[#10B981]" /> En línea</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#94A3B8]"><span className="w-2 h-2 rounded-full bg-[#CBD5E1]" /> Fuera de línea</span>
              )}
              <ChevronRight size={16} className="text-[#CBD5E1] shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
