'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, Check } from 'lucide-react'
import { updateOrganizationFiscal } from '@/features/admin/services/admin.service'

type Initial = { name: string; legal_name: string; tax_id: string; address: string; phone: string }

export function OrgFiscalForm({ orgId, initial }: { orgId: string; initial: Initial }) {
  const router = useRouter()
  const [legalName, setLegalName] = useState(initial.legal_name)
  const [name, setName] = useState(initial.name)
  const [taxId, setTaxId] = useState(initial.tax_id)
  const [address, setAddress] = useState(initial.address)
  const [phone, setPhone] = useState(initial.phone)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save() {
    setError(null); setSaved(false)
    start(async () => {
      const res = await updateOrganizationFiscal(orgId, { name, legal_name: legalName, tax_id: taxId, address, phone })
      if (res?.error) { setError(res.error); return }
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      router.refresh()
    })
  }

  const inp = 'w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]'
  const lbl = 'block text-[11px] text-[#5B6B7C] mb-1'

  return (
    <div className="bg-white border border-[#E6EBF2] rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-[#0B2545] flex items-center gap-2"><Building2 size={15} className="text-[#0E9E86]" /> Datos fiscales (para cuentas de cobro)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><label className={lbl}>Razón social</label><input value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Nombre legal de la empresa" className={inp} /></div>
        <div><label className={lbl}>Nombre comercial</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre corto/comercial" className={inp} /></div>
        <div><label className={lbl}>NIT / C.C.</label><input value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="Ej: 901234567-8" className={inp} /></div>
        <div className="sm:col-span-2"><label className={lbl}>Dirección</label><input value={address} onChange={e => setAddress(e.target.value)} placeholder="Dirección de facturación" className={inp} /></div>
        <div><label className={lbl}>Teléfono</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Teléfono" className={inp} /></div>
      </div>
      {error && <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={pending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium disabled:opacity-50">
          {pending ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} className="text-[#0B2545]" /> : null} {saved ? 'Guardado' : 'Guardar datos fiscales'}
        </button>
        <span className="text-[11px] text-[#94A3B8]">El NIT y la dirección aparecen en las cuentas de cobro e informes.</span>
      </div>
    </div>
  )
}
