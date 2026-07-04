import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { NewTicketForm } from './new-ticket-form'

export default function NewTicketPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/client/tickets" className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#1E293B] mb-4">
          <ArrowLeft size={14} /> Volver a tickets
        </Link>
        <h1 className="text-xl font-semibold text-[#1E293B]">Nuevo ticket</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Describe tu problema o solicitud</p>
      </div>
      <NewTicketForm />
    </div>
  )
}
