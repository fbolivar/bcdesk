import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Receipt, Send, FileText, FileSpreadsheet } from 'lucide-react'
import { revalidatePath } from 'next/cache'

interface Props { params: Promise<{ orgId: string }>; searchParams: Promise<{ saved?: string; access?: string }> }

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-[#1789FC]/20 text-[#1789FC]',
  in_progress: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  resolved: 'bg-[#10B981]/20 text-[#10B981]',
  closed: 'bg-[#E6EBF2] text-[#5B6B7C]',
}
const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-[#5B6B7C]', medium: 'text-[#1789FC]', high: 'text-[#F59E0B]', critical: 'text-[#EF4444]',
}

export default async function OrgDetailPage({ params, searchParams }: Props) {
  const { orgId } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: org } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  if (!org) redirect('/admin/org-portal')

  const [{ data: tickets }, { data: members }, { data: agents }] = await Promise.all([
    supabase.from('tickets').select('id, title, status, priority, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('profiles').select('id, full_name, email, role')
      .eq('organization_id', orgId),
    supabase.from('profiles').select('id, full_name').in('role', ['admin','agent']),
  ])

  async function handleCreateTicket(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('tickets').insert({
      title: formData.get('title') as string,
      description: formData.get('description') as string || '',
      priority: formData.get('priority') as string || 'medium',
      category: (formData.get('category') as string) || 'support',
      status: 'open',
      organization_id: orgId,
      created_by: (formData.get('requester_id') as string) || user?.id,
      source: 'admin',
      source_channel: 'web',
    })
    if (error) throw new Error(error.message)
    revalidatePath(`/admin/org-portal/${orgId}`)
  }

  async function handleSendAccessLink(formData: FormData) {
    'use server'
    const email = formData.get('email') as string
    const { requestPasswordReset } = await import('@/features/auth/services/auth.service')
    await requestPasswordReset(email)
    redirect(`/admin/org-portal/${orgId}?access=sent`)
  }

  async function handleFiscal(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { error } = await supabase.from('organizations').update({
      legal_name: (formData.get('legal_name') as string)?.trim() || null,
      tax_id: (formData.get('tax_id') as string)?.trim() || null,
      address: (formData.get('address') as string)?.trim() || null,
      phone: (formData.get('phone') as string)?.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', orgId)
    if (error) throw new Error(error.message)
    revalidatePath(`/admin/org-portal/${orgId}`)
    redirect(`/admin/org-portal/${orgId}?saved=fiscal`)
  }

  const ticketList = tickets ?? []
  const memberList = members ?? []
  const open = ticketList.filter(t => ['open','in_progress'].includes(t.status)).length

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/org-portal" className="flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">
        <ArrowLeft size={14} /> Volver
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">{org.name}</h1>
          {org.website && <p className="text-sm text-[#5B6B7C]">{org.website}</p>}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="px-3 py-1.5 bg-[#E6EBF2] rounded-lg text-[#0B2545]">
            {open} abiertos
          </div>
          <div className="px-3 py-1.5 bg-[#E6EBF2] rounded-lg text-[#0B2545]">
            {memberList.length} usuarios
          </div>
          <Link href={`/admin/invoices?org=${orgId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium border border-[#E6EBF2] text-[#10B981] bg-[#FFFFFF] hover:bg-[#10B981]/10 transition-colors">
            <Receipt size={14} /> Facturar
          </Link>
          <a href={`/api/admin/reports/export/pdf?org=${orgId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium bg-[#0B2545] hover:bg-[#0B2545]/90 text-white transition-colors" title="Reporte del cliente en PDF">
            <FileText size={14} /> PDF
          </a>
          <a href={`/api/admin/reports/export/xlsx?org=${orgId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium bg-[#10B981] hover:bg-[#059669] text-white transition-colors" title="Reporte del cliente en Excel">
            <FileSpreadsheet size={14} /> Excel
          </a>
        </div>
      </div>

      {/* Datos fiscales del cliente (para la cuenta de cobro) */}
      <details className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl" open={sp.saved === 'fiscal' || !org.tax_id || !org.legal_name}>
        <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-[#5B6B7C] hover:text-[#0B2545] select-none">
          Datos de facturación del cliente {(!org.tax_id || !org.legal_name) && <span className="text-[10px] text-[#F59E0B]">· completar NIT / razón social</span>}
        </summary>
        {sp.saved === 'fiscal' && (
          <div className="mx-4 mt-1 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-medium">
            ✓ Datos del cliente guardados.
          </div>
        )}
        <form action={handleFiscal} className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[#E6EBF2] pt-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Razón social</label>
            <input name="legal_name" defaultValue={org.legal_name ?? ''} placeholder="BIOFIX S.A.S"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">NIT / C.C.</label>
            <input name="tax_id" defaultValue={org.tax_id ?? ''} placeholder="900.123.456-7"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Dirección</label>
            <input name="address" defaultValue={org.address ?? ''} placeholder="Calle 00 # 00-00, Ciudad"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Teléfono</label>
            <input name="phone" defaultValue={org.phone ?? ''} placeholder="+57 …"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">Guardar datos</button>
          </div>
        </form>
      </details>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Create ticket on behalf */}
        <div className="col-span-1 bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-3">Crear ticket</h2>
          <form action={handleCreateTicket} className="space-y-2">
            <input name="title" required placeholder="Título del ticket"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-xs focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
            <textarea name="description" rows={2} placeholder="Descripción"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-xs focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1] resize-none" />
            <select name="priority"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-xs focus:outline-none focus:border-[#1789FC]">
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
            <select name="category" defaultValue="support"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-xs focus:outline-none focus:border-[#1789FC]">
              <option value="support">Soporte</option>
              <option value="software">Software</option>
              <option value="hardware">Hardware</option>
              <option value="network">Red</option>
              <option value="security">Seguridad</option>
              <option value="access">Acceso</option>
              <option value="service_request">Solicitud de servicio</option>
              <option value="development">Desarrollo</option>
              <option value="other">Otro</option>
            </select>
            <select name="requester_id"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-xs focus:outline-none focus:border-[#1789FC]">
              <option value="">Solicitante (opcional)</option>
              {memberList.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            <button type="submit"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-xs font-medium transition-colors">
              <Plus size={12} /> Crear
            </button>
          </form>
        </div>

        {/* Tickets list */}
        <div className="col-span-2 bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#E6EBF2]">
            <p className="text-xs font-semibold text-[#5B6B7C]">TICKETS ({ticketList.length})</p>
          </div>
          <div className="divide-y divide-[#E6EBF2]/50">
            {ticketList.map(t => (
              <Link key={t.id} href={`/admin/tickets/${t.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-[#EEF2F7] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#0B2545] truncate">{t.title}</p>
                  <p className="text-xs text-[#5B6B7C]">{new Date(t.created_at).toLocaleDateString('es-CO')}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className={`text-xs font-medium ${PRIORITY_COLOR[t.priority]}`}>{t.priority}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[t.status]}`}>{t.status}</span>
                </div>
              </Link>
            ))}
            {ticketList.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[#5B6B7C]">Sin tickets</div>
            )}
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#E6EBF2]">
          <p className="text-xs font-semibold text-[#5B6B7C]">USUARIOS ({memberList.length})</p>
        </div>
        {sp.access === 'sent' && (
          <div className="px-4 py-2.5 bg-[#10B981]/10 border-b border-[#10B981]/30 text-[#10B981] text-xs font-medium">
            ✓ Enlace de acceso enviado. El cliente recibirá un correo para crear su contraseña (válido 1 hora).
          </div>
        )}
        <div className="divide-y divide-[#E6EBF2]/50">
          {memberList.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#E6EBF2] flex items-center justify-center text-xs text-[#0B2545] font-medium">
                  {m.full_name?.charAt(0) ?? '?'}
                </div>
                <div>
                  <p className="text-sm text-[#0B2545]">{m.full_name}</p>
                  <p className="text-xs text-[#5B6B7C]">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#CBD5E1]">{m.role}</span>
                <form action={handleSendAccessLink}>
                  <input type="hidden" name="email" value={m.email} />
                  <button type="submit"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#E6EBF2] hover:bg-[#1789FC]/15 text-[#5B6B7C] hover:text-[#1789FC] text-xs font-medium transition-colors">
                    <Send size={12} /> Enviar enlace de acceso
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
