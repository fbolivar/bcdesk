const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
  'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
]
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

/** Convierte 0..999 a letras. */
function tercio(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  let out = ''
  const c = Math.floor(n / 100)
  const resto = n % 100
  if (c) out += CENTENAS[c] + ' '
  if (resto < 30) out += UNIDADES[resto]
  else {
    const d = Math.floor(resto / 10)
    const u = resto % 10
    out += DECENAS[d]
    if (u) out += ' y ' + UNIDADES[u]
  }
  return out.trim()
}

/** "un" en vez de "uno"/"veintiuno" cuando antecede a un sustantivo (millón, mil). */
function apocopar(s: string): string {
  return s.replace(/veintiuno$/, 'veintiún').replace(/\buno$/, 'un')
}

/** Monto en pesos colombianos a letras (para "Son: … pesos m/cte."). */
export function numberToWordsCOP(amount: number): string {
  let n = Math.max(0, Math.round(amount))
  if (n === 0) return 'cero pesos m/cte.'

  const partes: string[] = []
  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000

  if (millones) {
    if (millones === 1) partes.push('un millón')
    else partes.push(apocopar(tercio(millones)) + ' millones')
  }
  if (miles) {
    if (miles === 1) partes.push('mil')
    else partes.push(apocopar(tercio(miles)) + ' mil')
  }
  if (resto) partes.push(tercio(resto))

  const words = partes.join(' ').replace(/\s+/g, ' ').trim()
  return `${words} pesos m/cte.`
}

/** Igual pero con la primera letra en mayúscula. */
export function numberToWordsCOPCapitalized(amount: number): string {
  const w = numberToWordsCOP(amount)
  return w.charAt(0).toUpperCase() + w.slice(1)
}
