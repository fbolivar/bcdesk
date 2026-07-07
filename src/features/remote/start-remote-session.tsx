'use client'

import { useRouter } from 'next/navigation'
import { Monitor, MonitorPlay } from 'lucide-react'

export function StartRemoteSession({ basePath = '/admin', mode = 'screen', ticketId, compact = false }: { basePath?: string; mode?: 'screen' | 'control'; ticketId?: string; compact?: boolean }) {
  const router = useRouter()

  function start() {
    const token = (crypto.randomUUID?.() ?? String(Math.random())).replace(/-/g, '').slice(0, 14)
    const path = mode === 'control' ? `${basePath}/remote/control/${token}` : `${basePath}/remote/${token}`
    router.push(ticketId ? `${path}?ticket=${ticketId}` : path)
  }

  const isControl = mode === 'control'
  return (
    <button onClick={start}
      className={`flex items-center gap-2 rounded-xl font-semibold transition-transform hover:scale-[1.02] ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'}`}
      style={isControl
        ? { background: '#fff', color: '#1789FC', border: '1px solid rgba(23,137,252,0.4)' }
        : { background: '#1789FC', color: '#fff' }}>
      {isControl
        ? <><MonitorPlay size={compact ? 14 : 16} /> 🛠️ {compact ? 'RustDesk' : 'Control remoto (RustDesk)'}</>
        : <><Monitor size={compact ? 14 : 16} /> 🖥️ {compact ? 'Ver pantalla' : 'Sesión en vivo (navegador)'}</>}
    </button>
  )
}
