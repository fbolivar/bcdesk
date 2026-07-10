import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { fmtDateOnly } from '@/lib/date'
import { ArrowLeft, Plus, Trash2, FileText, CheckCircle2, Clock } from 'lucide-react'

interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string; saved?: string }> }

const inp = 'w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]'
const lbl = 'block text-[11px] text-[#5B6B7C] mb-1'

export default async function ContractDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) redirect('/dashboard')

  const { data: contract } = await supabase
    .from('service_contracts').select('*, organizations(name, legal_name, tax_id)').eq('id', id).single()
  if (!contract) notFound()
  const org = (Array.isArray(contract.organizations) ? contract.organizations[0] : contract.organizations) as { name: string; legal_name: string | null; tax_id: string | null } | null

  const from = sp.from || String(contract.start_date).slice(0, 10)
  const to = sp.to || String(contract.end_date).slice(0, 10)

  const { data: acts } = await supabase.from('contract_activities').select('*')
    .eq('contract_id', id).gte('activity_date', from).lte('activity_date', to).order('activity_date', { ascending: false })
  const activities = acts ?? []
  const totalHours = activities.reduce((s, a) => s + Number(a.hours ?? 0), 0)

  async function handleAdd(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const desc = (formData.get('description') as string)?.trim()
    if (!desc) return
    await supabase.from('contract_activities').insert({
      contract_id: id,
      organization_id: contract!.organization_id,
      activity_date: (formData.get('activity_date') as string) || undefined,
      description: desc,
      hours: parseFloat(String(formData.get('hours') ?? '0').replace(',', '.')) || 0,
      obligation: (formData.get('obligation') as string)?.trim() || null,
      result: (formData.get('result') as string)?.trim() || null,
      created_by: user!.id,
    })
    revalidatePath(`/admin/contracts/${id}`)
    redirect(`/admin/contracts/${id}?from=${from}&to=${to}&saved=1`)
  }

  async function handleDelete(actId: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('contract_activities').delete().eq('id', actId)
    revalidatePath(`/admin/contracts/${id}`)
  }

  const reportQs = new URLSearchParams({ from, to }).toString()

  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/admin/contracts" className="inline-flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">
        <ArrowLeft size={14} /> Volver a contratos
      </Link>

      {/* Cabecera del contrato */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-[#0B2545]">{contract.name}</h1>
            <p className="text-sm text-[#5B6B7C]">{org?.legal_name || org?.name}{org?.tax_id ? ` · NIT ${org.tax_id}` : ''}</p>
            <p className="text-xs text-[#94A3B8] mt-1">Vigencia: {fmtDateOnly(contract.start_date)} – {fmtDateOnly(contract.end_date)} · {contract.contract_type}</p>
          </div>
          <a href={`/api/admin/contracts/${id}/report/pdf?${reportQs}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B2545] hover:bg-[#0B2545]/90 text-white text-sm font-medium">
            <FileText size={14} /> Generar informe (PDF)
          </a>
        </div>
      </div>

      {/* Periodo del informe */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl p-5">
        <p className="text-sm font-semibold text-[#0B2545] mb-3">Periodo del informe</p>
        <form className="flex items-end gap-3 flex-wrap">
          <div><label className={lbl}>Desde</label><input type="date" name="from" defaultValue={from} className={inp} /></div>
          <div><label className={lbl}>Hasta</label><input type="date" name="to" defaultValue={to} className={inp} /></div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium">Aplicar</button>
          <span className="text-xs text-[#5B6B7C] inline-flex items-center gap-1"><Clock size={12} /> {activities.length} actividades · {Math.round(totalHours * 10) / 10} h</span>
        </form>
      </div>

      {saved(sp)}

      {/* Registrar actividad */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl p-5">
        <p className="text-sm font-semibold text-[#0B2545] mb-3">Registrar actividad</p>
        <form action={handleAdd} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
          <div className="sm:col-span-1"><label className={lbl}>Fecha</label><input type="date" name="activity_date" defaultValue={to} className={inp} /></div>
          <div className="sm:col-span-1"><label className={lbl}>Horas</label><input type="number" name="hours" min="0" step="0.25" defaultValue="1" className={inp} /></div>
          <div className="sm:col-span-4"><label className={lbl}>Obligación / entregable (opcional)</label><input name="obligation" placeholder="ej: Soporte y monitoreo de la infraestructura" className={inp} /></div>
          <div className="sm:col-span-6"><label className={lbl}>Descripción *</label><textarea name="description" required rows={2} placeholder="Describe la actividad ejecutada…" className={`${inp} resize-y`} /></div>
          <div className="sm:col-span-6"><label className={lbl}>Resultado / evidencia (opcional)</label><input name="result" placeholder="ej: Ticket #1056 resuelto; acta VT-2026-0001" className={inp} /></div>
          <div className="sm:col-span-6 flex justify-end">
            <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium"><Plus size={14} /> Agregar actividad</button>
          </div>
        </form>
      </div>

      {/* Lista de actividades */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E6EBF2]"><p className="text-sm font-semibold text-[#0B2545]">Actividades del periodo ({activities.length})</p></div>
        {activities.length ? (
          <div className="divide-y divide-[#E6EBF2]/60">
            {activities.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[#5B6B7C]">
                    <span className="font-medium text-[#0B2545]">{fmtDateOnly(a.activity_date)}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#E6EBF2] text-[#5B6B7C]">{Number(a.hours)} h</span>
                    {a.obligation && <span className="truncate">{a.obligation}</span>}
                  </div>
                  <p className="text-sm text-[#0B2545] mt-1 whitespace-pre-wrap">{a.description}</p>
                  {a.result && <p className="text-xs text-[#5B6B7C] mt-0.5">Resultado: {a.result}</p>}
                </div>
                <form action={handleDelete.bind(null, a.id)}>
                  <button type="submit" className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10"><Trash2 size={14} /></button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-[#94A3B8]">Sin actividades en este periodo. Agrega la primera arriba.</p>
        )}
      </div>
    </div>
  )
}

function saved(sp: { saved?: string }) {
  if (sp.saved !== '1') return null
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-sm font-medium">
      <CheckCircle2 size={16} /> Actividad registrada.
    </div>
  )
}
