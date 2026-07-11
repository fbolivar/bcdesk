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
        style={{ border: '1px solid #E6EBF2' }}
      >
        <textarea
          ref={textRef}
          name="content"
          rows={3}
          required
          placeholder="Escribe tu respuesta..."
          className="w-full px-4 py-3 text-sm resize-none focus:outline-none transition-colors"
          style={{ background: '#F4F7FB', color: '#0B2545' }}
        />

        <div
          className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
          style={{ borderTop: '1px solid #E6EBF2', background: '#FFFFFF' }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'rgba(0, 212, 170,0.1)', color: '#00D4AA', border: '1px solid rgba(0, 212, 170,0.15)' }}
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
              <span className="text-xs" style={{ color: '#5B6B7C' }}>
                {files.length} archivo{files.length > 1 ? 's' : ''} seleccionado{files.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            style={{ background: '#00D4AA', color: '#0B2545' }}
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
              style={{ background: '#FFFFFF', border: '1px solid #F4F7FB' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip size={11} style={{ color: '#00D4AA' }} />
                <span className="truncate" style={{ color: '#0B2545' }}>{f.name}</span>
                <span style={{ color: '#5B6B7C' }}>({(f.size / 1024).toFixed(0)} KB)</span>
              </div>
              <button type="button" onClick={() => removeFile(idx)} style={{ color: '#5B6B7C' }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </form>
  )
}
