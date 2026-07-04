'use client'

import { useState } from 'react'
import { Pencil, X, Loader2 } from 'lucide-react'
import { updateAsset } from '../services/asset.service'

interface Asset {
  id: string; name: string; asset_tag: string | null; asset_type: string; status: string
  manufacturer: string | null; model: string | null; serial_number: string | null
  location: string | null; organization_id: string | null; warranty_expiry: string | null; notes: string | null
}

const TYPES = [['hardware', 'Hardware'], ['software', 'Software'], ['network', 'Red'], ['service', 'Servicio'], ['other', 'Otro']]
const STATUSES = [['active', 'Activo'], ['inactive', 'Inactivo'], ['maintenance', 'Mantenimiento'], ['retired', 'Retirado']]

const input = 'w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#CBD5E1]'
const label = 'block text-xs text-[#64748B] mb-1'

export function AssetEditModal({ asset, orgs }: { asset: Asset; orgs: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    setSaving(true)
    const res = await updateAsset({
      id: asset.id,
      name: fd.get('name') as string,
      asset_tag: fd.get('asset_tag') as string,
      asset_type: fd.get('asset_type') as string,
      status: fd.get('status') as string,
      manufacturer: fd.get('manufacturer') as string,
      model: fd.get('model') as string,
      serial_number: fd.get('serial_number') as string,
      location: fd.get('location') as string,
      organization_id: (fd.get('organization_id') as string) || null,
      warranty_expiry: fd.get('warranty_expiry') as string,
      notes: fd.get('notes') as string,
    })
    setSaving(false)
    if (res?.error) { setError(res.error); return }
    setOpen(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title="Editar"
        className="p-1.5 rounded text-[#64748B] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-colors">
        <Pencil size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.4)' }} onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ border: '1px solid #E6EBF2' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#1E293B]">Editar activo</h2>
              <button onClick={() => setOpen(false)} className="text-[#64748B] hover:text-[#1E293B]"><X size={18} /></button>
            </div>
            <form onSubmit={onSubmit} className="grid grid-cols-3 gap-3">
              <div><label className={label}>Nombre *</label><input name="name" required defaultValue={asset.name} className={input} /></div>
              <div><label className={label}>Tag / Código</label><input name="asset_tag" defaultValue={asset.asset_tag ?? ''} className={input} /></div>
              <div><label className={label}>Tipo</label>
                <select name="asset_type" defaultValue={asset.asset_type} className={input}>
                  {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div><label className={label}>Estado</label>
                <select name="status" defaultValue={asset.status} className={input}>
                  {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div><label className={label}>Fabricante</label><input name="manufacturer" defaultValue={asset.manufacturer ?? ''} className={input} /></div>
              <div><label className={label}>Modelo</label><input name="model" defaultValue={asset.model ?? ''} className={input} /></div>
              <div><label className={label}>Serial</label><input name="serial_number" defaultValue={asset.serial_number ?? ''} className={input} /></div>
              <div><label className={label}>Ubicación</label><input name="location" defaultValue={asset.location ?? ''} className={input} /></div>
              <div><label className={label}>Garantía hasta</label><input name="warranty_expiry" type="date" defaultValue={asset.warranty_expiry ?? ''} className={input} /></div>
              <div className="col-span-2"><label className={label}>Organización</label>
                <select name="organization_id" defaultValue={asset.organization_id ?? ''} className={input}>
                  <option value="">Sin organización</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="col-span-3"><label className={label}>Notas</label><textarea name="notes" rows={2} defaultValue={asset.notes ?? ''} className={input} /></div>
              {error && <p className="col-span-3 text-xs text-[#EF4444] bg-[#EF4444]/10 rounded-lg px-3 py-2">{error}</p>}
              <div className="col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-[#64748B] hover:bg-[#F4F7FB]">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
