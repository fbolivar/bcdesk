'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Send, Paperclip, X, Loader2 } from 'lucide-react'
import { addComment } from '@/features/tickets/services/agent.service'

/** Formulario de respuesta con carga de documentos adjuntos.
 *  Crea el comentario, obtiene su id y sube los archivos vinculados a ese comentario. */
export function ReplyBox({ ticketId, allowInternal = true }: { ticketId: string; allowInternal?: boolean }) {
  const [isInternal, setIsInternal] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function addFiles(list: FileList | null) {
    if (!list) return
    setFiles(prev => [...prev, ...Array.from(list)])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  function submit() {
    const content = textRef.current?.value.trim() ?? ''
    if (!content) { setError('Escribe una respuesta.'); return }
    setError(null)
    startTransition(async () => {
      try {
        const res = await addComment(ticketId, content, isInternal)
        if (files.length > 0 && res?.id) {
          const fd = new FormData()
          fd.append('ticketId', ticketId)
          fd.append('commentId', res.id)
          files.forEach(f => fd.append('files', f))
          const up = await fetch('/api/tickets/upload-attachments', { method: 'POST', body: fd })
          const j = await up.json().catch(() => ({}))
          if (!up.ok) {
            setError(j.error ?? 'La respuesta se envió, pero falló la carga de los archivos.')
          } else if ((j.uploaded?.length ?? 0) < files.length) {
            setError('La respuesta se envió, pero algún archivo no se pudo adjuntar (tipo no permitido o supera 10 MB).')
          }
        }
        if (textRef.current) textRef.current.value = ''
        setFiles([])
        setIsInternal(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo enviar la respuesta.')
      }
    })
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4 space-y-3">
      <textarea ref={textRef} rows={3} disabled={pending} placeholder="Escribe una respuesta..."
        className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] transition-colors resize-none text-sm disabled:opacity-60" />

      {/* Archivos seleccionados */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-xs text-[#0B2545]">
              <Paperclip size={11} className="text-[#5B6B7C]" />
              <span className="max-w-[180px] truncate">{f.name}</span>
              <button type="button" onClick={() => removeFile(i)} disabled={pending}
                className="w-4 h-4 rounded flex items-center justify-center text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" multiple onChange={e => addFiles(e.target.files)}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" className="hidden" />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={pending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545] text-xs font-medium transition-colors disabled:opacity-50">
            <Paperclip size={13} /> Adjuntar
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] disabled:opacity-50 text-white text-sm font-medium transition-colors">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {pending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>

      <p className="text-[11px] text-[#94A3B8]">Imágenes, PDF, Word, Excel, TXT o ZIP · máx. 10 MB por archivo</p>
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}
