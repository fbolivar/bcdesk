export const LOCALES = ['es', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'es'

/** Cookie legible tanto en el navegador como en el servidor. */
export const LOCALE_COOKIE = 'bcdesk_locale'
/** Clave espejo en localStorage (compatibilidad con el selector previo). */
export const LOCALE_STORAGE = 'bcdesk_locale'

export function isLocale(v: unknown): v is Locale {
  return v === 'es' || v === 'en'
}
