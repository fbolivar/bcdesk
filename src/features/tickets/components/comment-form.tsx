'use client'

import { useRef, useState, useTransition } from 'react'
import { Lock, MessageSquare, Send } from 'lucide-react'
import { addComment } from '@/features/tickets/services/agent.service'

interface CommentFormProps {
  ticketId: string
}

export function CommentForm({ ticketId }: CommentFormProps) {
  const [isInternal, setIsInternal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const content = (form.elements.namedItem('content') as HTMLTextAreaElement).value

    setError(null)
    startTransition(async () => {
      try {
        await addComment(ticketId, content, isInternal)
        formRef.current?.reset()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al agregar comentario')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div className={`rounded-xl border transition-colors ${
        isInternal
          ? 'bg-[#F59E0B]/5 border-[#F59E0B]/20'
          : 'bg-[#FFFFFF] border-[#E6EBF2]'
      }`}>
        <textarea
          name="content"
          rows={4}
          required
          disabled={isPending}
          placeholder={isInternal ? 'Nota interna (no visible para el cliente)...' : 'Escribe una respuesta...'}
          className="w-full bg-transparent text-[#1E293B] text-sm placeholder:text-[#64748B] p-4 resize-none focus:outline-none rounded-xl"
        />
        <div className="px-4 pb-3 flex items-center justify-between border-t border-[#E6EBF2]/50">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              className={`w-8 h-4 rounded-full transition-colors relative ${
                isInternal ? 'bg-[#F59E0B]' : 'bg-[#E6EBF2]'
              }`}
              onClick={() => setIsInternal(!isInternal)}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                isInternal ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </div>
            <Lock size={12} className={isInternal ? 'text-[#F59E0B]' : 'text-[#64748B]'} />
            <span className={`text-xs ${isInternal ? 'text-[#F59E0B]' : 'text-[#64748B]'}`}>
              Nota interna
            </span>
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Send size={14} />
            {isPending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-[#EF4444]">{error}</p>
      )}
    </form>
  )
}
