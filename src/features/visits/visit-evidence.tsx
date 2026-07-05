'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2 } from 'lucide-react'

export function VisitEvidenceUpload({ visitId }: { visitId: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setErr('')
    setBusy(true)
    const fd = new FormData()
    fd.append('visit_id', visitId)
    files.forEach(f => fd.append('files', f))
    try {
      const res = await fetch('/api/visits/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(j.error ?? 'No se pudo subir la evidencia')
      } else {
        router.refresh()
      }
    } catch {
      setErr('Error de red al subir')
    }
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" multiple capture="environment" onChange={onFiles} className="hidden" />
      <button onClick={() => inputRef.current?.click()} disabled={busy}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
        {busy ? 'Subiendo…' : 'Agregar fotos'}
      </button>
      {err && <p className="text-xs text-[#EF4444] mt-1.5">{err}</p>}
    </div>
  )
}
