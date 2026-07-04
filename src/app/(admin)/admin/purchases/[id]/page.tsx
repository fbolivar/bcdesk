import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, GitPullRequest, ShoppingCart, XCircle, Trash2 } from 'lucide-react'
import { submitPurchaseForApproval, cancelPurchaseRequest, deletePurchaseRequest } from '@/features/admin/services/purchase.service'
import { ApprovalPanel } from '@/features/admin/components/approval-panel'

interface Props { params: Promise<{ id: string }> }

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-[#E6EBF2] text-[#64748B]',
  submitted: 'bg-[#3B82F6]/20 text-[#3B82F6]',
  approved: 'bg-[#10B981]/20 text-[#10B981]',
  rejected: 'bg-[#EF4444]/20 text-[#EF4444]',
  cancelled: 'bg-[#E6EBF2] text-[#64748B]',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', submitted: 'En aprobación', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada',
}

export default async function PurchaseDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'agent'].includes(myProfile?.role ?? '')) redirect('/dashboard')

  const { data: p } = await supabase
    .from('purchase_requests')
    .select('*, creator:profiles!purchase_requests_requested_by_fkey(full_name)')
    .eq('id', id)
    .single()
  if (!p) notFound()

  const creator = Array.isArray(p.creator) ? p.creator[0] : p.creator
  const amountFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: p.currency || 'USD' }).format(p.amount)

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/purchases" className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#1E293B] transition-colors w-fit">
        <ArrowLeft size={14} /> Volver a compras
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-[#1E293B] flex items-center gap-2">
            <ShoppingCart size={18} className="text-[#3B82F6]" /> {p.title}
          </h1>
          <p className="text-sm text-[#64748B] mt-1">{p.vendor || 'Sin proveedor'} · Solicitado por {creator?.full_name ?? '—'}</p>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_COLOR[p.status] ?? 'bg-[#E6EBF2] text-[#64748B]'}`}>
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
          <p className="text-xs text-[#64748B] mb-1">Monto</p>
          <p className="text-2xl font-bold text-[#1E293B]">{amountFmt}</p>
        </div>
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 md:col-span-2">
          <p className="text-xs text-[#64748B] mb-1">Descripción / justificación</p>
          <p className="text-sm text-[#1E293B] whitespace-pre-wrap">{p.description || '—'}</p>
        </div>
      </div>

      {/* Panel de aprobación (si hay workflow activo) */}
      <ApprovalPanel entityType="purchase" entityId={id} />

      {/* Acciones */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-3">
        <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Acciones</p>

        {p.status === 'draft' && (
          <form action={submitPurchaseForApproval.bind(null, id)}>
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              <GitPullRequest size={14} /> Enviar a aprobación
            </button>
          </form>
        )}

        {['draft', 'submitted'].includes(p.status) && (
          <form action={cancelPurchaseRequest.bind(null, id)}>
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-transparent hover:bg-[#EF4444]/10 text-[#64748B] hover:text-[#EF4444] text-xs transition-colors border border-[#E6EBF2] hover:border-[#EF4444]/30">
              <XCircle size={13} /> Cancelar solicitud
            </button>
          </form>
        )}

        {p.status === 'submitted' && (
          <p className="text-xs text-[#64748B] text-center">
            En proceso de aprobación. Revisa el panel de arriba.
          </p>
        )}

        <form action={deletePurchaseRequest.bind(null, id)}>
          <button type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[#CBD5E1] hover:text-[#EF4444] text-xs transition-colors">
            <Trash2 size={12} /> Eliminar
          </button>
        </form>
      </div>
    </div>
  )
}
