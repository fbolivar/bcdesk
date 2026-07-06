/** Footer de marca: atribución de marca personal + razón social (small print). */
export function BrandFooter({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return (
    <footer className={`text-center leading-relaxed ${compact ? 'text-[10px]' : 'text-[11px]'} ${className}`}>
      <p style={{ color: '#5B6B7C' }}>
        HexDesk · operado por{' '}
        <span style={{ color: '#0B2545', fontWeight: 600 }}>Fernando Bolívar Buitrago</span>
        {' '}· Consultor en Ciberseguridad
      </p>
      <p style={{ color: '#94A3B8' }}>
        Práctica independiente de consultoría · BC Fabric SAS
      </p>
    </footer>
  )
}
