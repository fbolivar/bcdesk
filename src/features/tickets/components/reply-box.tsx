'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Send, Paperclip, Loader2, Check, AlertCircle } from 'lucide-react'
import { addComment } from '@/features/tickets/services/agent.service'

type Canned = { id: string; title: string; content: string }

type Upload = { key: string; name: string; status: 'uploading' | 'done' | 'error'; error?: string }

const HARDCODED_CANNED: Canned[] = [
  { id: 'h1', title: 'Acuse de recibo', content: 'Hemos recibido tu solicitud y la estamos procesando. Te contactaremos a la brevedad.' },
  { id: 'h2', title: 'Solicitar más info', content: 'Para poder ayudarte mejor, ¿podrías proporcionarnos más detalles sobre el problema?' },
  { id: 'h3', title: 'Problema resuelto', content: 'Hemos solucionado el problema. Por favor confírmanos si todo está funcionando correctamente.' },
  { id: 'h4', title: 'Escalado', content: 'Tu caso ha sido escalado a nuestro equipo especializado. Te contactaremos a la brevedad con una solución.' },
  { id: 'h5', title: 'En proceso', content: 'Estamos trabajando activamente en tu caso. Te mantendremos informado de cualquier avance.' },
]

/** Formulario de respuesta. Los adjuntos se suben AL INSTANTE al seleccionarlos
 *  (no dependen de escribir texto ni de pulsar "Enviar"), con confirmación visible. */
export function ReplyBox({ ticketId, allowInternal = true, cannedResponses }: { ticketId: string; allowInternal?: boolean; cannedResponses?: Canned[] }) {
  const [isInternal, setIsInternal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [pending, startTransition] = useTransition()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [showAllCanned, setShowAllCanned] = useState(false)
  const canned = cannedResponses ? [...HARDCODED_CANNED, ...cannedResponses] : []
  const visibleCanned = showAllCanned ? canned : canned.slice(0, 5)

  const uploading = uploads.some(u => u.status === 'uploading')

  function onPick(list: FileList | null) {
    // Capturar los archivos ANTES de limpiar el input: `list` es el mismo objeto
    // que fileRef.current.files, así que si limpiamos primero se vacía y no sube nada.
    if (!list || list.length === 0) return
    const picked = Array.from(list)
    if (fileRef.current) fileRef.current.value = ''
    setError(null)
    picked.forEach(uploadOne)
  }

  async function uploadOne(file: File) {
    const key = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`
    setUploads(prev => [...prev, { key, name: file.name, status: 'uploading' }])
    try {
      const fd = new FormData()
      fd.append('ticketId', ticketId)
      fd.append('files', file)
      const up = await fetch('/api/tickets/upload-attachments', { method: 'POST', body: fd })
      const j = await up.json().catch(() => ({} as { error?: string; failed?: { reason: string }[] }))
      if (!up.ok) throw new Error(j.error ?? `Error ${up.status}`)
      if (j.failed && j.failed.length > 0) throw new Error(j.failed[0].reason)
      setUploads(prev => prev.map(u => u.key === key ? { ...u, status: 'done' } : u))
      router.refresh()
    } catch (e) {
      setUploads(prev => prev.map(u => u.key === key ? { ...u, status: 'error', error: e instanceof Error ? e.message : 'Error' } : u))
    }
  }

  function removeUpload(key: string) {
    setUploads(prev => prev.filter(u => u.key !== key))
  }

  function submit() {
    const content = textRef.current?.value.trim() ?? ''
    if (!content) { setError('Escribe una respuesta.'); return }
    setError(null)
    startTransition(async () => {
      try {
        await addComment(ticketId, content, isInternal)
        if (textRef.current) textRef.current.value = ''
        setIsInternal(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo enviar la respuesta.')
      }
    })
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 space-y-3">
      {canned.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[#5B6B7C]">Respuestas rápidas:</span>
          {visibleCanned.map(qr => (
            <button key={qr.id} type="button" title={qr.content} disabled={pending}
              onClick={() => { if (textRef.current) { textRef.current.value = qr.content; textRef.current.focus() } }}
              className="text-[10px] px-2.5 py-1 rounded-full bg-[#E6EBF2] text-[#5B6B7C] hover:bg-[#00D4AA]/20 hover:text-[#0E9E86] transition-colors max-w-[140px] truncate">
              {qr.title}
            </button>
          ))}
          {canned.length > 5 && (
            <button type="button" onClick={() => setShowAllCanned(v => !v)} className="text-[10px] text-[#5B6B7C] hover:text-[#0B2545]">
              {showAllCanned ? 'Menos' : `+${canned.length - 5} más`}
            </button>
          )}
        </div>
      )}
      {/* name="content": lo usa el Asistente IA ("Usar en respuesta") para localizar
          este textarea e insertar el borrador. */}
      <textarea ref={textRef} name="content" rows={3} disabled={pending} placeholder="Escribe una respuesta..."
        className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#00D4AA] transition-colors resize-none text-sm disabled:opacity-60" />

      {/* Adjuntos: se suben al seleccionarlos, con estado a la vista */}
      {uploads.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploads.map(u => (
            <span key={u.key} title={u.error}
              className={`inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-lg border text-xs ${
                u.status === 'error'
                  ? 'bg-[#EF4444]/5 border-[#EF4444]/30 text-[#EF4444]'
                  : u.status === 'done'
                    ? 'bg-[#10B981]/8 border-[#10B981]/30 text-[#0E9E86]'
                    : 'bg-[#F4F7FB] border-[#E6EBF2] text-[#5B6B7C]'
              }`}>
              {u.status === 'uploading' ? <Loader2 size={11} className="animate-spin" />
                : u.status === 'done' ? <Check size={11} />
                : <AlertCircle size={11} />}
              <span className="max-w-[180px] truncate">{u.name}</span>
              <span className="text-[10px] opacity-80">
                {u.status === 'uploading' ? 'subiendo…' : u.status === 'done' ? 'adjuntado' : (u.error ?? 'error')}
              </span>
              {u.status !== 'uploading' && (
                <button type="button" onClick={() => removeUpload(u.key)} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
              )}
            </span>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" multiple onChange={e => onPick(e.target.files)}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" className="hidden" />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545] text-xs font-medium transition-colors disabled:opacity-50">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />} Adjuntar
          </button>
          {allowInternal && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} disabled={pending}
                className="w-4 h-4 rounded border-[#E6EBF2] bg-[#F4F7FB] accent-[#F59E0B]" />
              <span className="text-xs text-[#5B6B7C] flex items-center gap-1"><Lock size={11} /> Nota interna</span>
            </label>
          )}
        </div>
        <button type="button" onClick={submit} disabled={pending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] disabled:opacity-50 text-white text-sm font-medium transition-colors">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {pending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>

      <p className="text-[11px] text-[#94A3B8]">Al pulsar <b>Adjuntar</b> el archivo se sube y guarda de inmediato (aparece “adjuntado”). El texto se envía con <b>Enviar</b>. Imágenes, PDF, Word, Excel, TXT o ZIP · máx. 10 MB.</p>
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}
