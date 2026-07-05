/**
 * Formato y catálogo de monedas (multimoneda).
 * Cada registro de dinero lleva su propia `currency`; aquí se formatea.
 */

export interface CurrencyDef { code: string; label: string; locale: string; decimals: number }

export const CURRENCIES: CurrencyDef[] = [
  { code: 'COP', label: 'Peso colombiano', locale: 'es-CO', decimals: 0 },
  { code: 'USD', label: 'Dólar', locale: 'en-US', decimals: 2 },
  { code: 'EUR', label: 'Euro', locale: 'es-ES', decimals: 2 },
  { code: 'MXN', label: 'Peso mexicano', locale: 'es-MX', decimals: 2 },
  { code: 'ARS', label: 'Peso argentino', locale: 'es-AR', decimals: 2 },
  { code: 'CLP', label: 'Peso chileno', locale: 'es-CL', decimals: 0 },
  { code: 'PEN', label: 'Sol', locale: 'es-PE', decimals: 2 },
  { code: 'BRL', label: 'Real', locale: 'pt-BR', decimals: 2 },
  { code: 'GBP', label: 'Libra', locale: 'en-GB', decimals: 2 },
]

export const DEFAULT_CURRENCY = 'COP'

const byCode = new Map(CURRENCIES.map(c => [c.code, c]))

/** Formatea un monto con su moneda (símbolo, separadores y decimales correctos). */
export function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  const code = currency || DEFAULT_CURRENCY
  const def = byCode.get(code)
  const value = amount ?? 0
  try {
    return new Intl.NumberFormat(def?.locale ?? 'es-CO', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: def?.decimals ?? 2,
      maximumFractionDigits: def?.decimals ?? 2,
    }).format(value)
  } catch {
    return `${code} ${value.toLocaleString()}`
  }
}
