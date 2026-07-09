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
