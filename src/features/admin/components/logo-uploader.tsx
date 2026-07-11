'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, Image as ImageIcon } from 'lucide-react'

/** Sube el logo a un bucket público y expone la URL en un input oculto
 *  (`name`), para que el formulario del branding la envíe al guardar. */
export function LogoUploader({ name = 'logo_url', initialUrl }: { name?: string; initialUrl?: string | null }) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(null); setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/branding/upload-logo', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setErr(j.error ?? 'No se pudo subir el logo')
      else setUrl(j.url)
    } catch {
      setErr('No se pudo subir el logo')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-lg border border-[#E6EBF2] bg-[#F4F7FB] flex items-center justify-center overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="logo" className="max-w-full max-h-full object-contain" /> : <ImageIcon size={20} className="text-[#CBD5E1]" />}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] disabled:opacity-60 text-white text-xs font-medium transition-colors">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {busy ? 'Subiendo…' : url ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {url && <button type="button" onClick={() => setUrl('')} className="px-2.5 py-1.5 rounded-lg text-xs text-[#5B6B7C] hover:text-[#EF4444]">Quitar</button>}
          </div>
          <p className="text-[10px] text-[#94A3B8]">PNG, JPG, WEBP o SVG · máx 2 MB</p>
          {err && <p className="text-[10px] text-[#EF4444]">{err}</p>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={onPick} className="hidden" />
    </div>
  )
}
