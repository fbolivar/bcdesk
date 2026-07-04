export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#EEF1F6' }}>

      {/* Aurora background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-30 animate-aurora"
          style={{
            background: 'linear-gradient(135deg, #4F8AFF22 0%, #8B6FFF22 25%, #00D4FF11 50%, #4F8AFF22 75%, #8B6FFF22 100%)',
            backgroundSize: '400% 400%',
          }}
        />
        {/* Orbs */}
        <div
          className="absolute rounded-full animate-float"
          style={{
            width: 600, height: 600,
            top: '-200px', left: '-200px',
            background: 'radial-gradient(circle, rgba(79,138,255,0.12) 0%, transparent 70%)',
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
        <div className="flex items-center justify-center gap-3 mb-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #4F8AFF 0%, #8B6FFF 100%)', boxShadow: '0 0 24px rgba(79,138,255,0.4)' }}
          >
            BC
          </div>
          <span className="text-2xl font-semibold tracking-tight" style={{ color: '#0F172A' }}>
            BC<span className="text-gradient">Desk</span>
          </span>
        </div>

        {children}
      </div>
    </div>
  )
}
