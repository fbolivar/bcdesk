'use client'

import { useState, useTransition } from 'react'
import { Pause, Play, Loader2 } from 'lucide-react'
import { setTicketSlaPause } from '@/features/tickets/services/agent.service'

export function SlaPauseToggle({ ticketId, paused }: { ticketId: string; paused: boolean }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    setError(null)
    start(async () => {
      const res = await setTicketSlaPause(ticketId, !paused)
      if (res?.error) setError(res.error)
    })
  }

  return (
    <div className="space-y-1">
      <button onClick={toggle} disabled={pending}
        className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
          paused
            ? 'bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545]'
            : 'bg-[#F4F7FB] border border-[#E6EBF2] text-[#5B6B7C] hover:text-[#0B2545] hover:border-[#F59E0B]'
        }`}>
        {pending ? <Loader2 size={13} className="animate-spin" /> : paused ? <Play size={13} /> : <Pause size={13} />}
        {paused ? 'Reanudar SLA' : 'Pausar SLA'}
      </button>
      {error && <p className="text-[10px] text-[#EF4444]">{error}</p>}
    </div>
  )
}
