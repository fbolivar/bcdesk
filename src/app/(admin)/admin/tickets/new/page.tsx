import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NewTicketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: orgs }, { data: agents }] = await Promise.all([
    supabase.from('organizations').select('id, name').eq('is_active', true).order('name'),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'agent']).eq('is_active', true).order('full_name'),
  ])

  async function createTicket(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const priority = formData.get('priority') as string
    const category = formData.get('category') as string
    const orgId = formData.get('organization_id') as string
    const assignedTo = formData.get('assigned_to') as string

    const { data } = await supabase.from('tickets').insert({
      title,
      description,
      priority,
      category,
      status: 'open',
      organization_id: orgId || null,
      assigned_to: assignedTo || null,
      created_by: user.id,
    }).select('id').single()

    revalidatePath('/admin/tickets')
    if (data?.id) redirect(`/admin/tickets/${data.id}`)
    else redirect('/admin/tickets')
  }

  const inputStyle = "w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
  const inputInlineStyle = {
    background: '#F4F7FB',
    border: '1px solid #E6EBF2',
    color: '#0F172A',
  } as React.CSSProperties

  const labelStyle = "block text-xs font-semibold uppercase tracking-wider mb-2" as const

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/tickets"
          className="p-2 rounded-xl transition-all"
          style={{ background: '#F4F7FB', border: '1px solid #E6EBF2', color: '#64748B' }}
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#0F172A' }}>Nuevo ticket</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Crear un ticket manualmente</p>
        </div>
      </div>

      <form action={createTicket} className="space-y-5">
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E6EBF2',
          }}
        >
          <div>
            <label className={labelStyle} style={{ color: '#64748B' }}>Título *</label>
            <input
              name="title"
              required
              placeholder="Describe el problema brevemente..."
              className={inputStyle}
              style={inputInlineStyle}
            />
          </div>

          <div>
            <label className={labelStyle} style={{ color: '#64748B' }}>Descripción</label>
            <textarea
              name="description"
              rows={5}
              placeholder="Detalles del problema, pasos para reproducirlo, impacto..."
              className={inputStyle}
              style={{ ...inputInlineStyle, resize: 'vertical' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelStyle} style={{ color: '#64748B' }}>Prioridad</label>
              <select name="priority" defaultValue="medium" className={inputStyle} style={inputInlineStyle}>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>
            <div>
              <label className={labelStyle} style={{ color: '#64748B' }}>Categoría</label>
              <select name="category" defaultValue="support" className={inputStyle} style={inputInlineStyle}>
                <option value="support">Soporte</option>
                <option value="development">Desarrollo</option>
                <option value="billing">Facturación</option>
                <option value="onboarding">Onboarding</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelStyle} style={{ color: '#64748B' }}>Cliente / Organización</label>
              <select name="organization_id" className={inputStyle} style={inputInlineStyle}>
                <option value="">Sin asignar</option>
                {(orgs ?? []).map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelStyle} style={{ color: '#64748B' }}>Asignar a agente</label>
              <select name="assigned_to" className={inputStyle} style={inputInlineStyle}>
                <option value="">Sin asignar</option>
                {(agents ?? []).map(a => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #4F8AFF 0%, #8B6FFF 100%)',
              boxShadow: '0 0 20px rgba(79,138,255,0.25)',
            }}
          >
            Crear ticket
          </button>
          <Link
            href="/admin/tickets"
            className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: '#F4F7FB',
              border: '1px solid #E6EBF2',
              color: '#64748B',
            }}
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
