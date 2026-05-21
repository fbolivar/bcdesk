'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Paperclip, X, ClipboardPaste, Image } from 'lucide-react'
import { AiDeflection } from '@/features/tickets/components/ai-deflection'

interface FileWithPreview {
  file: File
  preview?: string
}

export function NewTicketForm() {
  const [title, setTitle] = useState('')
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [uploading, setUploading] = useState(false)
  const [pasteFeedback, setPasteFeedback] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function addFiles(newFiles: File[]) {
    const withPreviews: FileWithPreview[] = newFiles.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))
    setFiles(prev => [...prev, ...withPreviews])
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []))
    if (fileRef.current) fileRef.current.value = ''
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageItems = Array.from(e.clipboardData.items).filter(
      item => item.kind === 'file' && item.type.startsWith('image/')
    )
    if (imageItems.length === 0) return

    const pastedFiles = imageItems
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null)
      .map((f, i) => {
        const ext = f.type.split('/')[1] || 'png'
        return new File([f], `captura-${Date.now()}-${i + 1}.${ext}`, { type: f.type })
      })

    if (pastedFiles.length > 0) {
      addFiles(pastedFiles)
      setPasteFeedback(true)
      setTimeout(() => setPasteFeedback(false), 2000)
    }
  }

  function removeFile(idx: number) {
    setFiles(prev => {
      const updated = prev.filter((_, i) => i !== idx)
      if (prev[idx].preview) URL.revokeObjectURL(prev[idx].preview!)
      return updated
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/tickets/create', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        console.error('Error creando ticket:', await res.text())
        return
      }
      const { id } = await res.json()

      if (files.length > 0) {
        try {
          const fd = new FormData()
          fd.append('ticketId', id)
          files.forEach(({ file }) => fd.append('files', file))
          await fetch('/api/tickets/upload-attachments', { method: 'POST', body: fd })
        } catch {
          // silently ignore
        }
      }

      router.push(`/client/tickets/${id}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B9BB4' }}>
          Título <span style={{ color: '#FF4D6A' }}>*</span>
        </label>
        <input
          name="title"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Resumen breve del problema"
          className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }}
        />
        <AiDeflection value={title} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B9BB4' }}>Categoría</label>
          <select
            name="category"
            defaultValue="support"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }}
          >
            <option value="support">Soporte</option>
            <option value="development">Desarrollo</option>
            <option value="billing">Facturación</option>
            <option value="onboarding">Onboarding</option>
            <option value="other">Otro</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B9BB4' }}>Prioridad</label>
          <select
            name="priority"
            defaultValue="medium"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }}
          >
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium" style={{ color: '#8B9BB4' }}>
            Descripción <span style={{ color: '#FF4D6A' }}>*</span>
          </label>
          <span
            className="flex items-center gap-1 text-[11px] transition-all duration-300"
            style={{ color: pasteFeedback ? '#10D98A' : '#4A5568' }}
          >
            <ClipboardPaste size={11} />
            {pasteFeedback ? '¡Imagen pegada!' : 'Ctrl+V para pegar imágenes'}
          </span>
        </div>
        <textarea
          name="description"
          required
          rows={6}
          placeholder="Describe el problema en detalle: qué estabas haciendo, qué esperabas que pasara, qué pasó realmente..."
          onPaste={handlePaste}
          className="w-full px-3 py-2.5 rounded-xl text-sm resize-none focus:outline-none transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#8B9BB4' }}>
          Adjuntos (opcional)
        </label>
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'rgba(79,138,255,0.12)', color: '#4F8AFF', border: '1px solid rgba(79,138,255,0.2)' }}
            >
              <Paperclip size={13} />
              Seleccionar archivos
            </button>
            <span className="text-xs" style={{ color: '#8B9BB4' }}>
              Imágenes, PDF, DOC, TXT
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
          {files.length > 0 && (
            <div className="space-y-2">
              {/* Thumbnails de imágenes pegadas */}
              {files.some(f => f.preview) && (
                <div className="flex flex-wrap gap-2 pb-2">
                  {files.map((f, idx) => f.preview ? (
                    <div key={idx} className="relative group">
                      <img
                        src={f.preview}
                        alt={f.file.name}
                        className="w-16 h-16 object-cover rounded-lg"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: '#FF4D6A' }}
                      >
                        <X size={9} color="#fff" />
                      </button>
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-b-lg px-1 py-0.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.7)' }}
                      >
                        <Image size={8} style={{ color: '#4F8AFF' }} />
                        <span className="text-[9px] truncate" style={{ color: '#F0F4FF' }}>
                          {(f.file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    </div>
                  ) : null)}
                </div>
              )}
              {/* Lista de archivos no-imagen */}
              {files.filter(f => !f.preview).map((f, idx) => {
                const realIdx = files.indexOf(f)
                return (
                  <div key={idx} className="flex items-center justify-between gap-2 text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip size={11} style={{ color: '#4F8AFF' }} />
                      <span className="truncate" style={{ color: '#F0F4FF' }}>{f.file.name}</span>
                      <span style={{ color: '#8B9BB4' }}>({(f.file.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <button type="button" onClick={() => removeFile(realIdx)} style={{ color: '#8B9BB4' }}>
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Link
          href="/client/tickets"
          className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ color: '#8B9BB4', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={uploading}
          className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          style={{ background: '#4F8AFF', color: '#fff' }}
        >
          {uploading ? 'Creando...' : 'Crear ticket'}
        </button>
      </div>
    </form>
  )
}
