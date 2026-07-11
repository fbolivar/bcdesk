'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

export function BackupRestore() {
  const [file, setFile] = useState<File | null>(null)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const canRestore = !!file && confirm.trim().toUpperCase() === 'RESTAURAR' && !busy

  async function onRestore() {
    if (!canRestore || !file) return
    setBusy(true); setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/backup/import', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setMsg({ ok: false, text: j.error ?? 'No se pudo restaurar el respaldo.' })
      else {
        setMsg({ ok: true, text: `Respaldo restaurado: ${j.total ?? 0} registros en ${Object.keys(j.restored ?? {}).length} tablas.` })
        setFile(null); setConfirm(''); if (fileRef.current) fileRef.current.value = ''
      }
    } catch {
      setMsg({ ok: false, text: 'Error de red al restaurar.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#B45309] text-xs">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
        <span>Restaurar <b>sobrescribe</b> los registros que coincidan (por id) con los del archivo. No borra lo que no esté en el respaldo. Úsalo con cuidado.</span>
      </div>

      <input ref={fileRef} type="file" accept=".fbb" onChange={e => { setFile(e.target.files?.[0] ?? null); setMsg(null) }}
        className="block w-full text-sm text-[#5B6B7C] file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#E6EBF2] file:text-[#0B2545] file:text-sm file:font-medium hover:file:bg-[#CBD5E1]" />

      {file && (
        <div>
          <label className="block text-xs text-[#5B6B7C] mb-1">Para confirmar, escribe <b>RESTAURAR</b></label>
          <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="RESTAURAR"
            className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]" />
        </div>
      )}

      <button type="button" onClick={onRestore} disabled={!canRestore}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B2545] hover:bg-[#0B2545]/90 disabled:opacity-50 text-white text-sm font-medium transition-colors">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {busy ? 'Restaurando…' : 'Restaurar respaldo'}
      </button>

      {msg && (
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${msg.ok ? 'bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981]' : 'bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]'}`}>
          {msg.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {msg.text}
        </div>
      )}
    </div>
  )
}
