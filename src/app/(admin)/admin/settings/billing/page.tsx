import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { ArrowLeft, Save, Building2, Landmark, FileText } from 'lucide-react'

const FIELDS = [
  'issuer_name', 'issuer_role', 'issuer_cc', 'issuer_cc_city', 'issuer_email', 'issuer_phone', 'issuer_city',
  'bank_name', 'bank_account_type', 'bank_account_number', 'bank_holder', 'bank_holder_cc', 'declarations',
] as const

export default async function BillingSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: bp } = await supabase.from('billing_profile').select('*').limit(1).maybeSingle()
  const v = (k: string) => (bp?.[k] ?? '') as string

  async function save(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const f of FIELDS) payload[f] = (formData.get(f) as string)?.trim() || null
    const { data: existing } = await supabase.from('billing_profile').select('id').limit(1).maybeSingle()
    if (existing) await supabase.from('billing_profile').update(payload).eq('id', existing.id)
    else await supabase.from('billing_profile').insert(payload)
    revalidatePath('/admin/settings/billing')
  }

  const cls = 'w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] transition-colors placeholder-[#CBD5E1]'
  const Field = ({ name, label, ph }: { name: string; label: string; ph?: string }) => (
    <div>
      <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">{label}</label>
      <input name={name} defaultValue={v(name)} placeholder={ph} className={cls} />
    </div>
  )

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/invoices" className="inline-flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">
        <ArrowLeft size={14} /> Volver a facturación
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Datos de facturación</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Aparecen en la cuenta de cobro (emisor, banco y declaraciones)</p>
      </div>

      <form action={save} className="space-y-6">
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-4 flex items-center gap-2"><Building2 size={15} className="text-[#1789FC]" /> Emisor (tú)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field name="issuer_name" label="Nombre completo" ph="Fernando Bolívar Buitrago" />
            <Field name="issuer_role" label="Cargo / profesión" ph="Consultor en Ciberseguridad" />
            <Field name="issuer_cc" label="Cédula (C.C.)" ph="1.234.567.890" />
            <Field name="issuer_cc_city" label="Expedida en" ph="Bogotá D.C." />
            <Field name="issuer_email" label="Correo" ph="fbolivarb@fernandobolivar.app" />
            <Field name="issuer_phone" label="Teléfono" ph="+57 300 406 9787" />
            <Field name="issuer_city" label="Ciudad" ph="Bogotá D.C., Colombia" />
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-4 flex items-center gap-2"><Landmark size={15} className="text-[#1789FC]" /> Datos bancarios para el pago</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field name="bank_name" label="Banco" ph="Bancolombia" />
            <div>
              <label className="block text-xs font-medium text-[#5B6B7C] mb-1.5">Tipo de cuenta</label>
              <select name="bank_account_type" defaultValue={v('bank_account_type')} className={cls}>
                <option value="">—</option>
                <option value="Ahorros">Ahorros</option>
                <option value="Corriente">Corriente</option>
              </select>
            </div>
            <Field name="bank_account_number" label="Número de cuenta" ph="000-000000-00" />
            <Field name="bank_holder" label="Titular" ph="Fernando Bolívar Buitrago" />
            <Field name="bank_holder_cc" label="C.C. del titular" ph="1.234.567.890" />
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#0B2545] mb-3 flex items-center gap-2"><FileText size={15} className="text-[#1789FC]" /> Declaraciones</h2>
          <p className="text-xs text-[#94A3B8] mb-2">Una por línea. Aparecen como viñetas en la cuenta de cobro.</p>
          <textarea name="declarations" defaultValue={v('declarations')} rows={6} className={`${cls} resize-y`} />
        </div>

        <button type="submit" className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
          <Save size={14} /> Guardar
        </button>
      </form>
    </div>
  )
}
