import { createServiceClient } from '@/lib/supabase/service'

/**
 * Identidad de marca para los correos salientes. Se lee desde org_branding
 * (editable en Admin → Branding) y cae a variables de entorno / valores por
 * defecto de HexDesk cuando un campo no está configurado.
 */
export type Brand = {
  name: string
  tagline: string
  color: string
  dark: string
  logoUrl: string
  supportEmail: string
  website: string
}

const DEFAULT: Brand = {
  name: process.env.MAIL_BRAND_NAME || 'HexDesk',
  tagline: process.env.MAIL_BRAND_TAGLINE || 'Mesa de ayuda · Fernando Bolívar · Consultor en Ciberseguridad',
  color: process.env.MAIL_BRAND_COLOR || '#1789FC',
  dark: '#0B2545',
  logoUrl: process.env.MAIL_BRAND_LOGO_URL || '',
  supportEmail: process.env.SUPPORT_EMAIL || 'soporte@fernandobolivar.app',
  website: process.env.MAIL_BRAND_WEBSITE || 'https://hexdesk.fernandobolivar.app',
}

/** Marca efectiva: org_branding sobre los valores por defecto. Nunca lanza. */
export async function getBrand(): Promise<Brand> {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('org_branding')
      .select('company_display_name, primary_color, logo_url, support_email, email_tagline, email_website')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!data) return DEFAULT
    return {
      name: data.company_display_name?.trim() || DEFAULT.name,
      tagline: data.email_tagline?.trim() || DEFAULT.tagline,
      color: data.primary_color?.trim() || DEFAULT.color,
      dark: DEFAULT.dark,
      logoUrl: data.logo_url?.trim() || DEFAULT.logoUrl,
      supportEmail: data.support_email?.trim() || DEFAULT.supportEmail,
      website: data.email_website?.trim() || DEFAULT.website,
    }
  } catch {
    return DEFAULT
  }
}

/** Etiqueta del sitio sin protocolo, para mostrar en la firma. */
export function brandWebsiteLabel(website: string): string {
  return (website || '').replace(/^https?:\/\//, '')
}
