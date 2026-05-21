import es from '../../../messages/es.json'
import en from '../../../messages/en.json'

type Messages = typeof es
type Locale = 'es' | 'en'

const messages: Record<Locale, Messages> = { es, en }

// Dot-notation path: 'tickets.open' → 'Abierto'
export function t(key: string, locale: Locale = 'es'): string {
  const parts = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = messages[locale]
  for (const part of parts) {
    obj = obj?.[part]
    if (obj === undefined) return key
  }
  return typeof obj === 'string' ? obj : key
}

export type { Locale, Messages }
