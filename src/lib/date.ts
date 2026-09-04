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

// '04 de septiembre de 2026, 10:00' en hora de Bogotá (24h) — para actas/reportes.
const dateTimeLongFmt = new Intl.DateTimeFormat('es-CO', { timeZone: TIMEZONE, day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
export function fmtDateTimeLong(d: DateInput, fallback = '—'): string {
  const x = toDate(d); return x ? dateTimeLongFmt.format(x).replace(',', ',') : fallback
}

// Valor 'YYYY-MM-DDTHH:mm' en hora de Bogotá para un <input type="datetime-local">
// (para que al editar se vea la hora local, no la UTC cruda del timestamptz).
const inputPartsFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
export function toBogotaInputValue(d: DateInput): string {
  const x = toDate(d); if (!x) return ''
  const p = inputPartsFmt.formatToParts(x)
  const g = (t: string) => p.find(part => part.type === t)?.value ?? ''
  const hh = g('hour') === '24' ? '00' : g('hour')
  return `${g('year')}-${g('month')}-${g('day')}T${hh}:${g('minute')}`
}

/**
 * Convierte el valor de un <input type="datetime-local"> (ej. '2026-09-04T10:00',
 * SIN zona) al instante correcto anclándolo a la hora de Colombia (UTC-5), para
 * guardarlo en una columna timestamptz. Sin esto, el string se interpretaba como
 * UTC y quedaba 5 horas corrido (10:00 se guardaba como 10:00 UTC = 05:00 Bogotá).
 * Si el valor ya trae zona (Z o ±hh:mm) se respeta.
 */
export function bogotaLocalToISO(v: string | null | undefined): string | null {
  if (!v) return null
  const s = String(v).trim()
  if (!s) return null
  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) return s // ya tiene zona
  const withSecs = /T\d{2}:\d{2}$/.test(s) ? `${s}:00` : s
  return `${withSecs}-05:00`
}

// Fechas puras (columnas `date`, sin hora): se muestran tal cual, SIN corrimiento
// por zona horaria. Se ancla a mediodía UTC (mismo día calendario en toda zona).
const dateOnlyFmt = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })
/** '07 jul 2026' para columnas DATE (contrato/factura), sin desfase de zona. */
export function fmtDateOnly(d: DateInput, fallback = '—'): string {
  const s = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T12:00:00Z' : d
  const x = toDate(s); return x ? dateOnlyFmt.format(x) : fallback
}
