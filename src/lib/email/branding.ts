/**
 * Identidad de marca para los correos salientes. Configurable por variables de
 * entorno; con valores por defecto para HexDesk / soporte@fernandobolivar.app.
 */
export const BRAND = {
  name: process.env.MAIL_BRAND_NAME || 'HexDesk',
  tagline: process.env.MAIL_BRAND_TAGLINE || 'Mesa de ayuda · Fernando Bolívar · Consultor en Ciberseguridad',
  color: process.env.MAIL_BRAND_COLOR || '#1789FC',
  dark: '#0B2545',
  logoUrl: process.env.MAIL_BRAND_LOGO_URL || '',
  supportEmail: process.env.SUPPORT_EMAIL || 'soporte@fernandobolivar.app',
  website: process.env.MAIL_BRAND_WEBSITE || 'https://hexdesk.fernandobolivar.app',
}

/** Nombre visible del sitio del enlace (sin protocolo). */
export function brandWebsiteLabel(): string {
  return BRAND.website.replace(/^https?:\/\//, '')
}
