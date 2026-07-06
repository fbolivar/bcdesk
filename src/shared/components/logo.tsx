/** Logo de HexDesk — hexágono con check + wordmark. Reutilizable en toda la app. */

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none"
      xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M50 5 L88 27 L88 73 L50 95 L12 73 L12 27 Z"
        stroke="#12D9A0" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" fill="none" />
      <path d="M31 51 L45 65 L70 36"
        stroke="#0F2540" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function Logo({
  size = 28,
  showText = true,
  showTagline = false,
}: {
  size?: number
  showText?: boolean
  showTagline?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      {showText && (
        <div className="leading-none">
          <div className="font-bold tracking-tight" style={{ fontSize: size * 0.62 }}>
            <span style={{ color: '#64748B' }}>Hex</span>
            <span style={{ color: '#10C08E' }}>Desk</span>
          </div>
          {showTagline && (
            <div className="uppercase tracking-[0.18em] mt-1" style={{ fontSize: size * 0.26, color: '#94A3B8' }}>
              Mesa de ayuda
            </div>
          )}
        </div>
      )}
    </div>
  )
}
