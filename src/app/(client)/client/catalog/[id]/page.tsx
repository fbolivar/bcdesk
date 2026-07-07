import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function CatalogItemRequestPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: item } = await supabase
    .from('service_catalog_items')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (!item) redirect('/client/catalog')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, organization_id')
    .eq('id', user.id)
    .single()

  async function handleSubmit(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const { data: ticket } = await supabase.from('tickets').insert({
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      priority: item.default_priority,
      category: item.default_category || item.category,
      status: 'open',
      created_by: user.id,
      organization_id: profile?.organization_id || null,
      service_item_id: id,
      source: 'catalog',
    }).select('id').single()

    if (ticket) {
      // Si hay un workflow de aprobación activo para solicitudes de servicio, inícialo.
      const { startApprovalRequest } = await import('@/features/admin/services/approval-engine.service')
      await startApprovalRequest('service_request', ticket.id)
      redirect(`/client/tickets/${ticket.id}`)
    }
    revalidatePath('/client/catalog')
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/client/catalog" className="flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545] transition-colors">
        <ArrowLeft size={14} /> Volver al catálogo
      </Link>

      <div className="flex items-center gap-3">
        <div className="text-3xl">{item.icon}</div>
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">{item.name}</h1>
          {item.description && <p className="text-sm text-[#5B6B7C] mt-0.5">{item.description}</p>}
        </div>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Título / Resumen *</label>
            <input name="title" required placeholder={`Solicitud de ${item.name}`}
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Descripción detallada *</label>
            <textarea name="description" required rows={5}
              placeholder="Describe tu solicitud con el mayor detalle posible..."
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1] resize-none" />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#E6EBF2]">
            <div className="text-xs text-[#5B6B7C]">
              <span>SLA: </span>
              <span className="text-[#5B6B7C]">{item.sla_hours} horas</span>
            </div>
            <button type="submit"
              className="px-5 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              Enviar solicitud
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
