'use client'

import { useTransition } from 'react'
import { markAccepted } from '../services/forum.actions'
import { CheckCircle, Loader2 } from 'lucide-react'

interface AcceptReplyButtonProps {
  replyId: string
  postId: string
  isAccepted: boolean
}

export function AcceptReplyButton({ replyId, postId, isAccepted }: AcceptReplyButtonProps) {
  const [isPending, startTransition] = useTransition()

  function handleAccept() {
    startTransition(async () => {
      await markAccepted(replyId, postId)
    })
  }

  if (isAccepted) {
    return (
      <span
        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
        style={{ background: 'rgba(16,217,138,0.15)', color: '#10D98A' }}
      >
        <CheckCircle size={12} />
        Aceptada
      </span>
    )
  }

  return (
    <button
      onClick={handleAccept}
      disabled={isPending}
      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-60"
      style={{
        background: 'rgba(16,217,138,0.08)',
        color: '#10D98A',
        border: '1px solid rgba(16,217,138,0.2)',
      }}
    >
      {isPending
        ? <Loader2 size={12} className="animate-spin" />
        : <CheckCircle size={12} />
      }
      Marcar como aceptada
    </button>
  )
}
