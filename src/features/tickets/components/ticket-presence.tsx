'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Viewer {
  userId: string
  name: string
  color: string
}

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899']

function hashColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

interface Props {
  ticketId: string
  userId: string
  userName: string
}

export function TicketPresence({ ticketId, userId, userName }: Props) {
  const [viewers, setViewers] = useState<Viewer[]>([])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`ticket-presence:${ticketId}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string }>()
        const others = Object.entries(state)
          .filter(([key]) => key !== userId)
          .map(([key, presences]) => ({
            userId: key,
            name: (presences as any[])[0]?.name ?? 'Agente',
            color: hashColor(key),
          }))
        setViewers(others)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: userName, at: Date.now() })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [ticketId, userId, userName])

  if (viewers.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#64748B]">También viendo:</span>
      <div className="flex -space-x-1.5">
        {viewers.slice(0, 4).map(v => (
          <div key={v.userId} title={v.name}
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-[#0F172A]"
            style={{ background: v.color }}>
            {v.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {viewers.length > 4 && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-[#0F172A] bg-[#334155] text-[#94A3B8]">
            +{viewers.length - 4}
          </div>
        )}
      </div>
      <span className="text-xs text-[#F59E0B] animate-pulse">● En vivo</span>
    </div>
  )
}
