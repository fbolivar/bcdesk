'use client'

import { useRouter } from 'next/navigation'
import { Monitor, MonitorPlay } from 'lucide-react'

export function StartRemoteSession({ basePath = '/admin', mode = 'screen' }: { basePath?: string; mode?: 'screen' | 'control' }) {
  const router = useRouter()

  function start() {
    const token = (crypto.randomUUID?.() ?? String(Math.random())).replace(/-/g, '').slice(0, 14)
    const path = mode === 'control' ? `${basePath}/remote/control/${token}` : `${basePath}/remote/${token}`
    router.push(path)
  }

  const isControl = mode === 'control'
  return (
    <button onClick={start}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-transform hover:scale-[1.02]"
      style={isControl
        ? { background: '#fff', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.4)' }
        : { background: '#3B82F6', color: '#fff' }}>
      {isControl ? <><MonitorPlay size={16} /> 🛠️ Control remoto (RustDesk)</> : <><Monitor size={16} /> 🖥️ Sesión en vivo (navegador)</>}
    </button>
  )
}
