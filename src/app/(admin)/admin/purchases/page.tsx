import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart, Plus } from 'lucide-react'
import { createPurchaseRequest } from '@/features/admin/services/purchase.service'

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-[#E6EBF2] text-[#5B6B7C]',
  submitted: 'bg-[#00D4AA]/20 text-[#0E9E86]',
  approved: 'bg-[#10B981]/20 text-[#10B981]',
  rejected: 'bg-[#EF4444]/20 text-[#EF4444]',
  cancelled: 'bg-[#E6EBF2] text-[#5B6B7C]',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', submitted: 'En aprobación', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada',
}

export default async function PurchasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'agent'].includes(myProfile?.role ?? '')) redirect('/dashboard')

  const { data: purchases } = await supabase
    .from('purchase_requests')
    .select('id, title, vendor, amount, currency, status, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545] flex items-center gap-2">
          <ShoppingCart size={18} className="text-[#0E9E86]" /> Solicitudes de compra
        </h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Crea y aprueba compras con flujos de aprobación multinivel.</p>
      </div>

      {/* Lista */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
        {(purchases ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm text-[#5B6B7C] text-center">Sin solicitudes de compra aún.</p>
        )}
        {(purchases ?? []).map(p => (
          <Link key={p.id} href={`/admin/purchases/${p.id}`}
            className="flex items-center gap-3 px-4 py-3 border-b border-[#E6EBF2]/50 last:border-0 hover:bg-[#F4F7FB]/50 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#0B2545] truncate">{p.title}</p>
              <p className="text-xs text-[#5B6B7C]">{p.vendor || 'Sin proveedor'}</p>
            </div>
            <span className="text-sm font-medium text-[#0B2545]">
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: p.currency || 'USD' }).format(p.amount)}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLOR[p.status] ?? 'bg-[#E6EBF2] text-[#5B6B7C]'}`}>
              {STATUS_LABEL[p.status] ?? p.status}
            </span>
          </Link>
        ))}
      </div>

      {/* Crear */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4 flex items-center gap-2">
          <Plus size={16} className="text-[#0E9E86]" /> Nueva solicitud de compra
        </h2>
        <form action={createPurchaseRequest} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Título *</label>
            <input name="title" required placeholder="Ej: 10 licencias Adobe Creative Cloud"
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#5B6B7C]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Descripción / justificación</label>
            <textarea name="description" rows={3} placeholder="Motivo de la compra…"
              className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#5B6B7C] resize-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Proveedor</label>
              <input name="vendor" placeholder="Proveedor"
                className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#5B6B7C]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Monto</label>
              <input name="amount" type="number" step="0.01" min="0" placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#5B6B7C]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Moneda</label>
              <select name="currency" defaultValue="COP"
                className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]">
                <option value="USD">USD</option>
                <option value="COP">COP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <button type="submit"
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors">
            <Plus size={14} /> Crear solicitud
          </button>
        </form>
      </div>
    </div>
  )
}
