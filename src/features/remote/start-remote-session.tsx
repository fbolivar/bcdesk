'use client'

import { useRouter } from 'next/navigation'
import { Monitor } from 'lucide-react'

export function StartRemoteSession({ basePath = '/admin' }: { basePath?: string }) {
  const router = useRouter()

  function start() {
    const token = (crypto.randomUUID?.() ?? String(Math.random())).replace(/-/g, '').slice(0, 14)
    router.push(`${basePath}/remote/${token}`)
  }

  return (
    <button onClick={start}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-transform hover:scale-[1.02]"
      style={{ background: '#3B82F6', color: '#fff' }}>
      <Monitor size={16} /> 🖥️ Iniciar sesión en vivo (navegador)
    </button>
  )
}
