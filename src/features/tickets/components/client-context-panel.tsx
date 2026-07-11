'use client'

import { fmtDateOnly, fmtDate } from '@/lib/date'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { TicketStatus } from '@/lib/supabase/types'

interface Props {
  clientId: string
  ticketId: string
}

interface ClientProfile {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  job_title: string | null
  organization_id: string | null
  created_at: string
  organizations: { name: string } | null
}

interface RecentTicket {
  id: string
  ticket_number: number
  title: string
  status: TicketStatus
  created_at: string
}

interface ServiceContract {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
}

interface ClientMetrics {
  total: number
  open: number
  avgCsat: number | null
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  waiting_client: 'Esperando',
  resolved: 'Resuelto',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-[#00D4AA]/20 text-[#0E9E86]',
  in_progress: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  waiting_client: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
  resolved: 'bg-[#10B981]/20 text-[#10B981]',
  closed: 'bg-[#E6EBF2] text-[#5B6B7C]',
  cancelled: 'bg-[#E6EBF2] text-[#5B6B7C]',
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[#E6EBF2]/60 rounded ${className ?? ''}`} />
  )
}

function SkeletonPanel() {
  return (
    <div className="space-y-4">
      {/* Profile skeleton */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3.5 w-32" />
            <SkeletonBlock className="h-3 w-44" />
          </div>
        </div>
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-5 w-36 rounded-full" />
      </div>
      {/* Metrics skeleton */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
        <SkeletonBlock className="h-3 w-28 mb-3" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-12 flex-1 rounded-lg" />
          <SkeletonBlock className="h-12 flex-1 rounded-lg" />
          <SkeletonBlock className="h-12 flex-1 rounded-lg" />
        </div>
      </div>
      {/* Tickets skeleton */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 space-y-2">
        <SkeletonBlock className="h-3 w-32 mb-3" />
        {[1, 2, 3].map(i => (
          <SkeletonBlock key={i} className="h-9" />
        ))}
      </div>
    </div>
  )
}

export function ClientContextPanel({ clientId, ticketId }: Props) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const [metrics, setMetrics] = useState<ClientMetrics | null>(null)
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([])
  const [contracts, setContracts] = useState<ServiceContract[]>([])

  useEffect(() => {
    if (!clientId) return

    const supabase = createClient()

    async function load() {
      setLoading(true)
      try {
        // 1. Perfil del cliente
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, job_title, organization_id, created_at, organizations(name)')
          .eq('id', clientId)
          .single()

        if (!profileData) {
          setLoading(false)
          return
        }

        const typedProfile = profileData as unknown as ClientProfile
        setProfile(typedProfile)

        // 2. Métricas: todos los tickets del cliente
        const { data: allTickets } = await supabase
          .from('tickets')
          .select('id, status, satisfaction_score')
          .eq('created_by', clientId)

        if (allTickets) {
          const openStatuses: TicketStatus[] = ['open', 'in_progress', 'waiting_client']
          const total = allTickets.length
          const open = allTickets.filter(t => openStatuses.includes(t.status as TicketStatus)).length
          const scored = allTickets.filter(t => t.satisfaction_score !== null)
          const avgCsat = scored.length > 0
            ? scored.reduce((sum, t) => sum + (t.satisfaction_score ?? 0), 0) / scored.length
            : null
          setMetrics({ total, open, avgCsat })
        }

        // 3. Tickets recientes (últimos 5, excluyendo el actual)
        const { data: ticketsData } = await supabase
          .from('tickets')
          .select('id, ticket_number, title, status, created_at')
          .eq('created_by', clientId)
          .neq('id', ticketId)
          .order('created_at', { ascending: false })
          .limit(5)

        setRecentTickets((ticketsData ?? []) as RecentTicket[])

        // 4. Contratos activos de la organización del cliente
        if (typedProfile.organization_id) {
          const { data: contractsData } = await supabase
            .from('service_contracts')
            .select('id, name, start_date, end_date, status')
            .eq('organization_id', typedProfile.organization_id)
            .eq('status', 'active')

          setContracts((contractsData ?? []) as ServiceContract[])
        }
      } catch {
        // Si falla silenciosamente no renderizamos
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [clientId, ticketId])

  if (!clientId) return null
  if (loading) return <SkeletonPanel />
  if (!profile) return null

  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div className="space-y-3">
      {/* Perfil del cliente */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5B6B7C] mb-3">
          Contexto del cliente
        </p>
        <div className="flex items-start gap-3 mb-3">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="w-10 h-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#00D4AA]/20 flex items-center justify-center text-sm font-semibold text-[#0E9E86] shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0B2545] truncate">{profile.full_name}</p>
            <p className="text-xs text-[#5B6B7C] truncate">{profile.email}</p>
            {profile.job_title && (
              <p className="text-xs text-[#5B6B7C] truncate">{profile.job_title}</p>
            )}
            {profile.organizations?.name && (
              <p className="text-xs text-[#5B6B7C] truncate">{profile.organizations.name}</p>
            )}
          </div>
        </div>
        <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-[#E6EBF2] text-[#5B6B7C]">
          Cliente desde {fmtDate(profile.created_at)}
        </span>
      </div>

      {/* Métricas rápidas */}
      {metrics && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5B6B7C] mb-3">
            Métricas
          </p>
          <div className="flex gap-2">
            <div className="flex-1 bg-[#F4F7FB] rounded-lg p-2 text-center">
              <p className="text-base font-bold text-[#0B2545]">{metrics.total}</p>
              <p className="text-[10px] text-[#5B6B7C]">Total</p>
            </div>
            <div className="flex-1 bg-[#F4F7FB] rounded-lg p-2 text-center">
              <p className="text-base font-bold text-[#0E9E86]">{metrics.open}</p>
              <p className="text-[10px] text-[#5B6B7C]">Abiertos</p>
            </div>
            <div className="flex-1 bg-[#F4F7FB] rounded-lg p-2 text-center">
              <p className="text-base font-bold text-[#0B2545]">
                {metrics.avgCsat !== null ? metrics.avgCsat.toFixed(1) : '—'}
              </p>
              <p className="text-[10px] text-[#5B6B7C]">CSAT</p>
            </div>
          </div>
        </div>
      )}

      {/* Tickets recientes */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5B6B7C] mb-3">
          Tickets recientes
        </p>
        {recentTickets.length === 0 ? (
          <p className="text-xs text-[#5B6B7C] py-2 text-center">Sin tickets anteriores</p>
        ) : (
          <div className="space-y-1.5">
            {recentTickets.map(ticket => (
              <a
                key={ticket.id}
                href={`/agent/tickets/${ticket.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#E6EBF2]/40 transition-colors group"
              >
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[ticket.status] ?? 'bg-[#E6EBF2] text-[#5B6B7C]'}`}>
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </span>
                <span className="flex-1 text-xs text-[#5B6B7C] group-hover:text-[#0B2545] truncate transition-colors">
                  {ticket.title.length > 40 ? ticket.title.slice(0, 40) + '…' : ticket.title}
                </span>
                <span className="shrink-0 text-[10px] text-[#5B6B7C]">
                  {formatDistanceToNow(new Date(ticket.created_at), { locale: es, addSuffix: false })}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Contratos activos */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5B6B7C] mb-3">
          Contratos activos
        </p>
        {contracts.length === 0 ? (
          <p className="text-xs text-[#5B6B7C] py-2 text-center">Sin contratos activos</p>
        ) : (
          <div className="space-y-2">
            {contracts.map(contract => (
              <div key={contract.id} className="p-2.5 bg-[#F4F7FB] rounded-lg">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-medium text-[#0B2545] leading-snug">{contract.name}</p>
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] font-medium">
                    Activo
                  </span>
                </div>
                <p className="text-[10px] text-[#5B6B7C]">
                  {fmtDateOnly(contract.start_date)}
                  {' — '}
                  {fmtDateOnly(contract.end_date)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
