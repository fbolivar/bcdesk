'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip, Send, X } from 'lucide-react'

interface ClientCommentFormProps {
  ticketId: string
}

export function ClientCommentForm({ ticketId }: ClientCommentFormProps) {
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    setFiles(prev => [...prev, ...picked])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const content = textRef.current?.value?.trim()
    if (!content) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/tickets/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, content }),
      })

      if (!res.ok) return

      const { commentId } = await res.json()

      if (files.length > 0 && commentId) {
        try {
          const fd = new FormData()
          fd.append('ticketId', ticketId)
          fd.append('commentId', commentId)
          files.forEach(f => fd.append('files', f))
          await fetch('/api/tickets/upload-attachments', { method: 'POST', body: fd })
        } catch {
          // silently ignore
        }
      }

      if (textRef.current) textRef.current.value = ''
      setFiles([])
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <textarea
          ref={textRef}
          name="content"
          rows={3}
          required
          placeholder="Escribe tu respuesta..."
          className="w-full px-4 py-3 text-sm resize-none focus:outline-none transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', color: '#F0F4FF' }}
        />

        <div
          className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'rgba(79,138,255,0.1)', color: '#4F8AFF', border: '1px solid rgba(79,138,255,0.15)' }}
            >
              <Paperclip size={12} />
              Adjuntar
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            {files.length > 0 && (
              <span className="text-xs" style={{ color: '#8B9BB4' }}>
                {files.length} archivo{files.length > 1 ? 's' : ''} seleccionado{files.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            style={{ background: '#4F8AFF', color: '#fff' }}
          >
            <Send size={14} />
            {submitting ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 text-xs rounded-lg px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip size={11} style={{ color: '#4F8AFF' }} />
                <span className="truncate" style={{ color: '#F0F4FF' }}>{f.name}</span>
                <span style={{ color: '#8B9BB4' }}>({(f.size / 1024).toFixed(0)} KB)</span>
              </div>
              <button type="button" onClick={() => removeFile(idx)} style={{ color: '#8B9BB4' }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </form>
  )
}
