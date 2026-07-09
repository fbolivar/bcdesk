/** Tipo de documento de cobro: factura, cuenta de cobro u otro (con etiqueta libre). */
export const DOC_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'cuenta_cobro', label: 'Cuenta de cobro' },
  { value: 'factura', label: 'Factura' },
  { value: 'otro', label: 'Otro…' },
]

/** Título a mostrar en el documento según el tipo elegido. */
export function docTitle(docType?: string | null, other?: string | null): string {
  if (docType === 'factura') return 'Factura'
  if (docType === 'otro') return other?.trim() || 'Documento'
  return 'Cuenta de cobro'
}

/** Correo de contacto que aparece en los documentos de cobro. */
export const INVOICE_CONTACT_EMAIL = 'fbolivarb@fernandobolivar.app'

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** 'YYYY-MM-DD' → "09 de julio de 2026" (sin corrimiento de zona horaria). */
export function fechaLargaES(d: string): string {
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number)
  if (!y || !m || !day) return String(d)
  return `${String(day).padStart(2, '0')} de ${MESES_ES[m - 1]} de ${y}`
}
