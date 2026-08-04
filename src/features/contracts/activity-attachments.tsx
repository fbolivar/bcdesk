'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip, Upload, Loader2, X, FileText } from 'lucide-react'

export type ActivityAttachment = { id: string; file_name: string; url: string }

export function ActivityAttachments({ activityId, attachments }: { activityId: string; attachments: ActivityAttachment[] }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true); setError(null)
    const fd = new FormData()
    Array.from(files).forEach(f => fd.append('files', f))
    try {
      const res = await fetch(`/api/admin/contracts/activities/${activityId}/attachments`, { method: 'POST', body: fd })
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? 'No se pudo subir'); }
      else router.refresh()
    } catch { setError('Error de red') } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove(id: string) {
    setError(null)
    const res = await fetch(`/api/admin/contracts/activities/${activityId}/attachments?id=${id}`, { method: 'DELETE' })
    if (res.ok) router.refresh(); else setError('No se pudo eliminar')
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {attachments.map(a => (
          <span key={a.id} className="inline-flex items-center gap-1.5 text-xs bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg pl-2 pr-1 py-1">
            <FileText size={12} className="text-[#0E9E86] shrink-0" />
            <a href={a.url} target="_blank" rel="noreferrer" className="text-[#0B2545] hover:text-[#0E9E86] max-w-[220px] truncate">{a.file_name}</a>
            <button onClick={() => remove(a.id)} title="Quitar" className="p-0.5 rounded text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10"><X size={12} /></button>
          </span>
        ))}
        <button onClick={() => inputRef.current?.click()} disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-dashed border-[#CBD5E1] text-[#5B6B7C] hover:border-[#00D4AA] hover:text-[#0E9E86] disabled:opacity-50">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {busy ? 'Subiendo…' : 'Adjuntar documento'}
        </button>
        <input ref={inputRef} type="file" multiple hidden onChange={e => onFiles(e.target.files)} />
      </div>
      {error && <p className="text-[11px] text-[#EF4444] mt-1">{error}</p>}
      {attachments.length === 0 && !error && <p className="text-[11px] text-[#94A3B8] mt-1 inline-flex items-center gap-1"><Paperclip size={11} /> Sin documentos.</p>}
    </div>
  )
}
