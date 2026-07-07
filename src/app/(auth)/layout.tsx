import { Logo } from '@/shared/components/logo'
import { BrandFooter } from '@/shared/components/brand-footer'
import { Ticket, MessageSquare, BookOpen, Wrench } from 'lucide-react'

// Render dinámico para que la CSP con nonce (middleware) se aplique a los scripts.
export const dynamic = 'force-dynamic'

const FEATURES = [
  { Icon: Ticket, title: 'Tickets & SLA', desc: 'Prioriza y resuelve a tiempo' },
  { Icon: MessageSquare, title: 'Chat en vivo', desc: 'Atiende a tus clientes sin fricción' },
  { Icon: BookOpen, title: 'Base de conocimiento', desc: 'Autoservicio 24/7' },
  { Icon: Wrench, title: 'Visitas técnicas', desc: 'Evidencia del servicio en sitio' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ───────── Panel de marca (service desk) ───────── */}
      <aside
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-16"
        style={{ background: 'radial-gradient(130% 130% at 0% 0%, #12406C 0%, #0B2545 45%, #071730 100%)' }}
      >
        {/* Glows + grid */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute rounded-full" style={{ width: 540, height: 540, top: -180, right: -140, background: 'radial-gradient(circle, rgba(0,212,170,0.18) 0%, transparent 70%)' }} />
          <div className="absolute rounded-full animate-float" style={{ width: 480, height: 480, bottom: -180, left: -120, background: 'radial-gradient(circle, rgba(23,137,252,0.22) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
        </div>

        {/* Logo claro */}
        <div className="relative z-10 flex items-center gap-3">
          <svg width={36} height={36} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Fernando Bolívar Buitrago">
            <path d="M50 5 L88 27 L88 73 L50 95 L12 73 L12 27 Z" stroke="#FFFFFF" strokeWidth="6" strokeLinejoin="round" />
            <path d="M50 17 L78 33 L78 67 L50 83 L22 67 L22 33 Z" stroke="#00D4AA" strokeWidth="2.5" strokeLinejoin="round" />
            <text x="50" y="51" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-inter), sans-serif" fontWeight="800" fontSize="30" fill="#FFFFFF" letterSpacing="-1">FB</text>
          </svg>
          <span className="text-xl font-bold tracking-tight">
            <span style={{ color: '#FFFFFF' }}>Hex</span><span style={{ color: '#00D4AA' }}>Desk</span>
          </span>
        </div>

        {/* Mensaje central */}
        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ background: 'rgba(0,212,170,0.12)', color: '#4FE3C4', border: '1px solid rgba(0,212,170,0.25)' }}>
            Mesa de ayuda
          </span>
          <h2 className="mt-5 text-[2rem] xl:text-[2.4rem] font-bold leading-[1.12] text-white">
            Soporte impecable,<br />de principio a fin.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed" style={{ color: '#AEBFD4' }}>
            Tickets, SLAs, chat en vivo, base de conocimiento y visitas técnicas — todo en una sola plataforma.
          </p>

          <div className="mt-9 space-y-4">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3.5">
                <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <Icon size={18} color="#4FE3C4" strokeWidth={2} />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs" style={{ color: '#8DA2BD' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer del panel */}
        <div className="relative z-10 text-xs leading-relaxed" style={{ color: '#5F779A' }}>
          Operado por <span style={{ color: '#AEBFD4' }}>Fernando Bolívar Buitrago</span> · Consultor en Ciberseguridad
        </div>
      </aside>

      {/* ───────── Formulario ───────── */}
      <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-10" style={{ background: '#F1F4F8' }}>
        <div className="w-full max-w-sm animate-fade-in-up">
          {/* Logo para móvil (el panel se oculta < lg) */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size={38} showTagline />
          </div>

          {children}

          <BrandFooter className="mt-8" />
        </div>
      </main>
    </div>
  )
}
