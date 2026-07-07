import { Logo } from '@/shared/components/logo'
import { BrandFooter } from '@/shared/components/brand-footer'

// Render dinámico para que la CSP con nonce (middleware) se aplique a los scripts.
export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#F1F4F8' }}>

      {/* Aurora background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-30 animate-aurora"
          style={{
            background: 'linear-gradient(135deg, #1789FC22 0%, #00D4AA22 25%, #0B254511 50%, #1789FC22 75%, #00D4AA22 100%)',
            backgroundSize: '400% 400%',
          }}
        />
        {/* Orbs */}
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: 600, height: 600,
            top: '-200px', left: '-200px',
            background: 'radial-gradient(circle, rgba(23,137,252,0.12) 0%, transparent 70%)',
            animationDelay: '0s',
          }}
        />
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: 500, height: 500,
            bottom: '-150px', right: '-150px',
            background: 'radial-gradient(circle, rgba(139,111,255,0.12) 0%, transparent 70%)',
            animationDelay: '-3s',
          }}
        />
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: 300, height: 300,
            top: '40%', left: '60%',
            background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
            animationDelay: '-1.5s',
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md px-4 animate-fade-in-up">
        {/* Logo */}
        <div className="flex items-center justify-center mb-10">
          <Logo size={40} showTagline />
        </div>

        {children}

        <BrandFooter className="mt-8" />
      </div>
    </div>
  )
}
