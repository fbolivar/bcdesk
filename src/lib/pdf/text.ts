import { rgb } from 'pdf-lib'

/** Prepara texto para las fuentes estándar de pdf-lib (WinAnsi):
 *  - neutraliza caracteres de control (\r, \t, saltos, NBSP) que la fuente no dibuja,
 *  - normaliza comillas/guiones tipográficos,
 *  - sustituye lo que quede fuera de Latin-1 por '?'.
 *  Centralizado para no repetir esta lógica (y su bug del \r) en cada PDF. */
export function cleanPdfText(s: string): string {
  return (s ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2022]/g, '-')
    .replace(/[^\x00-\xFF]/g, '?')
}

/** Convierte un color hex (#rrggbb) a rgb() de pdf-lib. Cae a azul si es inválido. */
export function hexToRgbPdf(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return rgb(0.09, 0.537, 0.988)
  const n = parseInt(m[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}
