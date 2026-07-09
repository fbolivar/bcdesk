'use client'

import { Trash2 } from 'lucide-react'
import { deleteInvoice } from '@/features/admin/services/admin.service'

export function DeleteInvoiceButton({ invoiceId }: { invoiceId: string }) {
  return (
    <form
      action={deleteInvoice.bind(null, invoiceId)}
      onSubmit={e => { if (!confirm('¿Eliminar esta cuenta de cobro? Esta acción no se puede deshacer.')) e.preventDefault() }}
    >
      <button type="submit"
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FFFFFF] border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 text-sm font-medium transition-colors">
        <Trash2 size={14} /> Eliminar
      </button>
    </form>
  )
}
