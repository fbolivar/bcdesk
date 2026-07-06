import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Estado del Sistema — HexDesk',
  description: 'Estado en tiempo real de los servicios de HexDesk',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#EEF1F6' }}>
      <header
        className="h-14 flex items-center px-6 gap-4"
        style={{
          background: '#FFFFFF',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid #E6EBF2',
        }}
      >
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{
              background: 'linear-gradient(135deg, #4F8AFF 0%, #8B6FFF 100%)',
              boxShadow: '0 0 14px rgba(79,138,255,0.4)',
            }}
          >
            BC
          </div>
          <span className="text-base font-semibold tracking-tight" style={{ color: '#0F172A' }}>
            HexDesk
          </span>
        </Link>

        <div className="flex-1" />

        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{ color: '#64748B' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Ir al portal
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {children}
      </main>
    </div>
  )
}
