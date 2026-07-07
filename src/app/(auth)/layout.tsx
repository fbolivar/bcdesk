import { AuthBackdrop } from '@/features/auth/components/auth-backdrop'
import { SupportFactory } from '@/features/auth/components/support-factory'

// Render dinámico para que la CSP con nonce (middleware) se aplique a los scripts.
export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-root">
      <AuthBackdrop />

      <div className="relative grid lg:grid-cols-[1.12fr_.88fr]" style={{ zIndex: 2, minHeight: '100svh' }}>
        <SupportFactory />

        <main className="flex flex-col items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm">
            {/* Logo para móvil (el panel de fábrica se oculta < lg) */}
            <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
              <svg width="32" height="32" viewBox="0 0 100 100" fill="none" aria-label="Fernando Bolívar Buitrago">
                <path d="M50 5 L88 27 L88 73 L50 95 L12 73 L12 27 Z" stroke="#FFFFFF" strokeWidth="6" strokeLinejoin="round" />
                <path d="M50 17 L78 33 L78 67 L50 83 L22 67 L22 33 Z" stroke="#00D4AA" strokeWidth="2.5" strokeLinejoin="round" />
                <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-inter)" fontWeight="800" fontSize="30" fill="#FFFFFF" letterSpacing="-1">FB</text>
              </svg>
              <span className="text-lg font-extrabold tracking-tight"><span className="text-white">Hex</span><span style={{ color: '#00D4AA' }}>Desk</span></span>
            </div>

            {children}

            <p className="lg:hidden text-center text-xs mt-7 leading-relaxed" style={{ color: '#5F779A' }}>
              HexDesk · operado por <b style={{ color: '#AEBFD4', fontWeight: 600 }}>Fernando Bolívar Buitrago</b> · Consultor en Ciberseguridad
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
