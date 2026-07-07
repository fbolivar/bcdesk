/**
 * Formateo de fechas SIEMPRE en America/Bogota (UTC-5), vía Intl (funciona en
 * server, cliente y edge, sin depender de la TZ del proceso). Los timestamps se
 * guardan en UTC (timestamptz); esto solo controla cómo se MUESTRAN/agrupan.
 */
export const TIMEZONE = 'America/Bogota'

type DateInput = Date | string | number | null | undefined

const toDate = (d: DateInput): Date | null => {
  if (d === null || d === undefined || d === '') return null
  const x = d instanceof Date ? d : new Date(d)
  return isNaN(x.getTime()) ? null : x
}

const dateFmt = new Intl.DateTimeFormat('es-CO', { timeZone: TIMEZONE, day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('es-CO', { timeZone: TIMEZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
const timeFmt = new Intl.DateTimeFormat('es-CO', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: true })
// en-CA da 'YYYY-MM-DD' (clave de día en calendario de Bogotá).
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

/** '07 jul 2026' */
export function fmtDate(d: DateInput, fallback = '—'): string {
  const x = toDate(d); return x ? dateFmt.format(x) : fallback
}
/** '07 jul 2026, 7:32 p. m.' */
export function fmtDateTime(d: DateInput, fallback = '—'): string {
  const x = toDate(d); return x ? dateTimeFmt.format(x) : fallback
}
/** '7:32 p. m.' */
export function fmtTime(d: DateInput, fallback = '—'): string {
  const x = toDate(d); return x ? timeFmt.format(x) : fallback
}
/** Clave de día 'YYYY-MM-DD' en calendario de Bogotá (para agrupar por día). */
export function bogotaDayKey(d: DateInput): string {
  const x = toDate(d); return x ? dayKeyFmt.format(x) : ''
}

// Fechas puras (columnas `date`, sin hora): se muestran tal cual, SIN corrimiento
// por zona horaria. Se ancla a mediodía UTC (mismo día calendario en toda zona).
const dateOnlyFmt = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })
/** '07 jul 2026' para columnas DATE (contrato/factura), sin desfase de zona. */
export function fmtDateOnly(d: DateInput, fallback = '—'): string {
  const s = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T12:00:00Z' : d
  const x = toDate(s); return x ? dateOnlyFmt.format(x) : fallback
}
