'use client'

import { useState, useRef } from 'react'
import { createForumReply } from '../services/forum.actions'
import { Send, Loader2 } from 'lucide-react'

interface ReplyFormProps {
  postId: string
}

export function ReplyForm({ postId }: ReplyFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    try {
      await createForumReply(postId, formData)
      formRef.current?.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al publicar la respuesta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <textarea
        name="body"
        required
        minLength={5}
        rows={4}
        placeholder="Escribe tu respuesta o comentario..."
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all resize-none"
        style={{
          background: '#F4F7FB',
          border: '1px solid #E6EBF2',
          color: '#0B2545',
        }}
      />

      {error && (
        <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
          style={{ background: '#00D4AA', color: '#0B2545' }}
        >
          {loading
            ? <Loader2 size={14} className="animate-spin" />
            : <Send size={14} />
          }
          Responder
        </button>
      </div>
    </form>
  )
}
