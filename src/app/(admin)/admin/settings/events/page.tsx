import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Activity } from 'lucide-react'
import { EventIngestGuide } from '@/features/admin/components/event-ingest-guide'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const ACTION_COLOR: Record<string, string> = {
  created: 'bg-[#EF4444]/20 text-[#EF4444]',
  correlated: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  resolved: 'bg-[#10B981]/20 text-[#10B981]',
  noop: 'bg-[#E6EBF2] text-[#64748B]',
}
const ACTION_LABEL: Record<string, string> = {
  created: 'Incidente creado', correlated: 'Correlacionado', resolved: 'Resuelto', noop: 'Sin acción',
}
const SEV_COLOR: Record<string, string> = {
  critical: 'text-[#EF4444]', high: 'text-[#F59E0B]', warning: 'text-[#F59E0B]', medium: 'text-[#3B82F6]', info: 'text-[#64748B]', low: 'text-[#64748B]',
}

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'agent'].includes(myProfile?.role ?? '')) redirect('/dashboard')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const [{ data: tokens }, { data: events }] = await Promise.all([
    supabase.from('org_api_tokens').select('token, is_active').eq('is_active', true).limit(1),
    supabase.from('monitoring_events')
      .select('id, source, severity, host, summary, status, action, ticket_id, created_at')
      .order('created_at', { ascending: false }).limit(50),
  ])

  const activeToken = tokens?.[0]?.token ?? null
  const eventList = events ?? []

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B] flex items-center gap-2">
          <Activity size={18} className="text-[#3B82F6]" /> Event Management
        </h1>
        <p className="text-sm text-[#64748B] mt-0.5">
          Convierte alertas de monitoreo en incidentes automáticamente, con deduplicación y auto-resolución.
        </p>
      </div>

      <EventIngestGuide appUrl={appUrl} token={activeToken} />

      {/* Recent events */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E6EBF2]">
          <h2 className="text-sm font-semibold text-[#1E293B]">Eventos recientes ({eventList.length})</h2>
        </div>
        {eventList.length === 0 && (
          <p className="px-4 py-6 text-sm text-[#64748B] text-center">Aún no se han recibido eventos.</p>
        )}
        {eventList.map(e => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#E6EBF2]/50 last:border-0">
            <span className={`text-[10px] font-semibold uppercase ${SEV_COLOR[e.severity] ?? 'text-[#64748B]'}`}>{e.severity}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#1E293B] truncate">{e.summary}</p>
              <p className="text-xs text-[#64748B]">{e.source}{e.host ? ` · ${e.host}` : ''}</p>
            </div>
            {e.ticket_id && (
              <Link href={`/admin/tickets/${e.ticket_id}`} className="text-[10px] text-[#4F8AFF] hover:underline">ver incidente</Link>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${ACTION_COLOR[e.action ?? 'noop']}`}>
              {ACTION_LABEL[e.action ?? 'noop']}
            </span>
            <span className="text-[10px] text-[#CBD5E1] shrink-0">
              {formatDistanceToNow(new Date(e.created_at), { locale: es, addSuffix: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
