'use client'

import { useState } from 'react'
import { toggleVote } from '../services/forum.actions'
import { ThumbsUp, Loader2 } from 'lucide-react'

interface VoteButtonProps {
  replyId: string
  upvotes: number
  hasVoted: boolean
}

export function VoteButton({ replyId, upvotes, hasVoted }: VoteButtonProps) {
  const [loading, setLoading] = useState(false)
  const [optimisticVoted, setOptimisticVoted] = useState(hasVoted)
  const [optimisticCount, setOptimisticCount] = useState(upvotes)

  async function handleVote() {
    setLoading(true)
    // Optimistic update
    setOptimisticVoted(v => !v)
    setOptimisticCount(c => optimisticVoted ? c - 1 : c + 1)
    try {
      await toggleVote(replyId)
    } catch {
      // Revert on error
      setOptimisticVoted(hasVoted)
      setOptimisticCount(upvotes)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleVote}
      disabled={loading}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
      style={{
        background: optimisticVoted ? 'rgba(0, 212, 170,0.15)' : '#F4F7FB',
        color: optimisticVoted ? '#00D4AA' : '#5B6B7C',
        border: `1px solid ${optimisticVoted ? 'rgba(0, 212, 170,0.3)' : 'transparent'}`,
      }}
    >
      {loading
        ? <Loader2 size={12} className="animate-spin" />
        : <ThumbsUp size={12} />
      }
      <span>{optimisticCount}</span>
    </button>
  )
}
