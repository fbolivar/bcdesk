import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, Users, Ticket, FileSignature, Receipt, ChevronRight } from 'lucide-react'
import { StatusBadge } from '@/shared/components/priority-badge'
import { RmmOrgPanel } from '@/features/rmm/rmm-org-panel'
import { OrgFiscalForm } from '@/features/admin/components/org-fiscal-form'
import { formatMoney } from '@/lib/format/currency'
import { fmtDateOnly } from '@/lib/date'

interface Props { params: Promise<{ id: string }> }

const card = 'bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl'

export default async function OrganizationDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/dashboard')

  const { data: orgRow } = await supabase.from('organizations').select('*').eq('id', id).single()
  if (!orgRow) notFound()
  const org = orgRow as {
    id: string; name: string; legal_name?: string | null; tax_id?: string | null
    address?: string | null; phone?: string | null; industry?: string | null
    status?: string | null; rmm_enabled?: boolean | null
  }

  const [contactsRes, ticketsRes, contractsRes, invoicesRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, job_title, is_active, is_org_admin')
      .eq('organization_id', id).eq('role', 'client').order('full_name'),
    supabase.from('tickets').select('id, ticket_number, title, status, priority, created_at')
      .eq('organization_id', id).order('created_at', { ascending: false }).limit(500),
    supabase.from('service_contracts').select('id, name, contract_type, status, start_date, end_date')
      .eq('organization_id', id).order('created_at', { ascending: false }),
    supabase.from('invoices').select('id, invoice_number, total_usd, currency, status, issue_date, due_date')
      .eq('organization_id', id).order('created_at', { ascending: false }),
  ])

  const contacts = contactsRes.data ?? []
  const tickets = ticketsRes.data ?? []
  const contracts = contractsRes.data ?? []
  const invoices = (invoicesRes.data ?? []) as { id: string; invoice_number: string; total_usd: number | null; currency: string | null; status: string; issue_date: string | null; due_date: string | null }[]

  const openTickets = tickets.filter(t => !['resolved', 'closed', 'cancelled', 'merged'].includes(t.status)).length
  const activeContracts = contracts.filter(c => c.status === 'active').length
  const pending = invoices.filter(i => ['sent', 'overdue'].includes(i.status))
  const pendingTotal = pending.reduce((s, i) => s + Number(i.total_usd ?? 0), 0)
  const pendingCur = pending[0]?.currency ?? 'COP'

  const kpis = [
    { label: 'Contactos', value: String(contacts.length), icon: Users, tone: '#8B5CF6' },
    { label: 'Tickets abiertos', value: `${openTickets}`, sub: `${tickets.length} en total`, icon: Ticket, tone: '#00D4AA' },
    { label: 'Contratos activos', value: String(activeContracts), sub: `${contracts.length} en total`, icon: FileSignature, tone: '#0E9E86' },
    { label: 'Por cobrar', value: pendingTotal > 0 ? formatMoney(pendingTotal, pendingCur) : '—', sub: `${pending.length} factura${pending.length !== 1 ? 's' : ''}`, icon: Receipt, tone: '#F59E0B' },
  ]

  const statusLabel: Record<string, string> = { active: 'Activo', draft: 'Borrador', expired: 'Vencido', cancelled: 'Cancelado', paused: 'En pausa' }
  const invStatusColor: Record<string, string> = { paid: 'text-[#10B981]', sent: 'text-[#0E9E86]', overdue: 'text-[#EF4444]', draft: 'text-[#94A3B8]', cancelled: 'text-[#94A3B8]' }

  return (
    <div className="space-y-5 max-w-5xl">
      <Link href="/admin/clients" className="inline-flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">
        <ArrowLeft size={14} /> Volver a clientes
      </Link>

      {/* Cabecera */}
      <div className={`${card} p-5`}>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#00D4AA]/12 flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-[#0E9E86]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[#0B2545]">{org.legal_name || org.name}</h1>
            <p className="text-sm text-[#5B6B7C]">
              {org.legal_name && org.legal_name !== org.name ? `${org.name} · ` : ''}
              {org.tax_id ? `NIT ${org.tax_id}` : 'Sin NIT'}
              {org.industry ? ` · ${org.industry}` : ''}
            </p>
            {(org.address || org.phone) && (
              <p className="text-xs text-[#94A3B8] mt-1">{[org.address, org.phone].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Datos fiscales (alimentan cuentas de cobro e informes) */}
      <OrgFiscalForm orgId={org.id} initial={{
        name: org.name ?? '', legal_name: org.legal_name ?? '', tax_id: org.tax_id ?? '',
        address: org.address ?? '', phone: org.phone ?? '',
      }} />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={`${card} p-4`}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${k.tone}15` }}>
                <k.icon size={15} style={{ color: k.tone }} />
              </div>
              <p className="text-[11px] text-[#5B6B7C]">{k.label}</p>
            </div>
            <p className="text-xl font-bold text-[#0B2545] mt-2">{k.value}</p>
            {k.sub && <p className="text-[11px] text-[#94A3B8]">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* RMM */}
      <RmmOrgPanel organizationId={org.id} initialEnabled={!!org.rmm_enabled} />

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Contactos */}
        <div className={`${card} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-[#E6EBF2] flex items-center gap-2">
            <Users size={14} className="text-[#8B5CF6]" />
            <h2 className="text-sm font-semibold text-[#0B2545]">Contactos ({contacts.length})</h2>
          </div>
          {contacts.length === 0 ? (
            <p className="px-4 py-6 text-xs text-[#94A3B8] text-center">Sin contactos.</p>
          ) : (
            <div className="divide-y divide-[#E6EBF2]/60">
              {contacts.map(c => (
                <Link key={c.id} href={`/admin/clients/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#EEF2F7]">
                  <div className="w-8 h-8 rounded-full bg-[#E6EBF2] flex items-center justify-center text-[#0B2545] text-xs font-semibold shrink-0">
                    {c.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0B2545] truncate">{c.full_name}
                      {c.is_org_admin && <span className="text-[10px] text-[#0E9E86] bg-[#00D4AA]/12 px-1.5 py-0.5 rounded-full ml-1.5 align-middle">Admin</span>}
                      {!c.is_active && <span className="text-[10px] text-[#94A3B8] bg-[#E6EBF2] px-1.5 py-0.5 rounded-full ml-1.5 align-middle">Inactivo</span>}
                    </p>
                    <p className="text-xs text-[#94A3B8] truncate">{c.email}{c.job_title ? ` · ${c.job_title}` : ''}</p>
                  </div>
                  <ChevronRight size={14} className="text-[#CBD5E1] shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Contratos */}
        <div className={`${card} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-[#E6EBF2] flex items-center gap-2">
            <FileSignature size={14} className="text-[#0E9E86]" />
            <h2 className="text-sm font-semibold text-[#0B2545]">Contratos ({contracts.length})</h2>
          </div>
          {contracts.length === 0 ? (
            <p className="px-4 py-6 text-xs text-[#94A3B8] text-center">Sin contratos.</p>
          ) : (
            <div className="divide-y divide-[#E6EBF2]/60">
              {contracts.map(c => (
                <Link key={c.id} href={`/admin/contracts/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#EEF2F7]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0B2545] truncate">{c.name}</p>
                    <p className="text-xs text-[#94A3B8]">{fmtDateOnly(c.start_date)} – {fmtDateOnly(c.end_date)}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${c.status === 'active' ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#E6EBF2] text-[#5B6B7C]'}`}>
                    {statusLabel[c.status] ?? c.status}
                  </span>
                  <ChevronRight size={14} className="text-[#CBD5E1] shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Facturación */}
        <div className={`${card} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-[#E6EBF2] flex items-center gap-2">
            <Receipt size={14} className="text-[#F59E0B]" />
            <h2 className="text-sm font-semibold text-[#0B2545]">Facturación ({invoices.length})</h2>
          </div>
          {invoices.length === 0 ? (
            <p className="px-4 py-6 text-xs text-[#94A3B8] text-center">Sin cuentas de cobro.</p>
          ) : (
            <div className="divide-y divide-[#E6EBF2]/60">
              {invoices.slice(0, 8).map(i => (
                <Link key={i.id} href={`/admin/invoices/${i.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#EEF2F7]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0B2545] truncate">{i.invoice_number}</p>
                    <p className="text-xs text-[#94A3B8]">{i.issue_date ? fmtDateOnly(i.issue_date) : '—'}</p>
                  </div>
                  <span className="text-sm text-[#0B2545]">{formatMoney(Number(i.total_usd ?? 0), i.currency ?? 'COP')}</span>
                  <span className={`text-[11px] shrink-0 w-16 text-right ${invStatusColor[i.status] ?? 'text-[#5B6B7C]'}`}>{i.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tickets recientes */}
        <div className={`${card} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-[#E6EBF2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ticket size={14} className="text-[#00D4AA]" />
              <h2 className="text-sm font-semibold text-[#0B2545]">Tickets recientes</h2>
            </div>
            <Link href={`/admin/tickets?org=${org.id}`} className="text-xs text-[#0E9E86]">Ver todos</Link>
          </div>
          {tickets.length === 0 ? (
            <p className="px-4 py-6 text-xs text-[#94A3B8] text-center">Sin tickets.</p>
          ) : (
            <div className="divide-y divide-[#E6EBF2]/60">
              {tickets.slice(0, 8).map(t => (
                <Link key={t.id} href={`/admin/tickets/${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#EEF2F7]">
                  <span className="text-xs font-mono text-[#94A3B8] shrink-0">#{t.ticket_number}</span>
                  <p className="flex-1 min-w-0 text-sm text-[#0B2545] truncate">{t.title}</p>
                  <StatusBadge status={t.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
