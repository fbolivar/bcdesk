'use client'

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-4"
      style={{ background: '#EEF1F6' }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'linear-gradient(135deg, #4F8AFF 0%, #8B6FFF 100%)', boxShadow: '0 0 32px rgba(79,138,255,0.3)' }}
      >
        <span className="text-white font-bold text-xl">BC</span>
      </div>

      <h1 className="text-2xl font-semibold mb-2" style={{ color: '#1E293B' }}>
        Sin conexión
      </h1>
      <p className="text-sm max-w-xs" style={{ color: '#64748B' }}>
        No hay conexión a internet. Revisa tu red y vuelve a intentarlo.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="mt-8 px-6 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: '#4F8AFF', color: '#fff' }}
      >
        Reintentar
      </button>
    </div>
  )
}
