'use client'

import { LogoMark } from '@/shared/components/logo'

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-4"
      style={{ background: '#F1F4F8' }}
    >
      <div className="mb-6">
        <LogoMark size={64} />
      </div>

      <h1 className="text-2xl font-semibold mb-2" style={{ color: '#0B2545' }}>
        Sin conexión
      </h1>
      <p className="text-sm max-w-xs" style={{ color: '#5B6B7C' }}>
        No hay conexión a internet. Revisa tu red y vuelve a intentarlo.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="mt-8 px-6 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: '#1789FC', color: '#fff' }}
      >
        Reintentar
      </button>
    </div>
  )
}
