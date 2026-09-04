import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { cleanPdfText as clean, hexToRgbPdf as hexToRgb } from '@/lib/pdf/text'
import type { Brand } from '@/lib/email/branding'
import { embedLogo } from '@/lib/pdf/logo'

export type VisitPdfImage = { bytes: Uint8Array; mime: string }

export type VisitPdfData = {
  visit_number: string
  title: string
  typeLabel: string
  statusLabel: string
  client: { name: string; address?: string | null; phone?: string | null }
  technician: { name?: string | null; email?: string | null }
  site?: string | null
  contact?: string | null
  scheduled?: string | null
  started?: string | null
  ended?: string | null
  materials?: string | null
  work_performed?: string | null
  findings?: string | null
  recommendations?: string | null
  client_signoff?: string | null
  generatedAt: string
  images: VisitPdfImage[]
}

/** Prepara texto para StandardFonts (WinAnsi):
 *  - convierte caracteres de control (\r, \t, saltos, …) en espacio,
 *  - normaliza comillas/guiones tipograficos,
 *  - sustituye lo que quede fuera de Latin-1 por '?'. */
// clean() -> @/lib/pdf/text
// hexToRgb() -> @/lib/pdf/text

export async function buildVisitPdf(brand: Brand, d: VisitPdfData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const logo = await embedLogo(doc, brand.logoUrl)

  const PW = 595.28, PH = 841.89, M = 50
  const dark = rgb(0.043, 0.145, 0.271)
  const gray = rgb(0.357, 0.42, 0.486)
  const line = rgb(0.8, 0.84, 0.89)
  const brandColor = hexToRgb(brand.color)

  let page: PDFPage = doc.addPage([PW, PH])
  const { width } = page.getSize()
  let y = PH - M

  /** Garantiza `space` px verticales; si no hay, crea página nueva. */
  const ensure = (space: number) => {
    if (y - space < M) { page = doc.addPage([PW, PH]); y = PH - M }
  }
  const T = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color = dark) =>
    page.drawText(clean(s), { x, y: yy, size, font: f, color })
  const R = (s: string, xr: number, yy: number, size: number, f: PDFFont = font, color = dark) => {
    const c = clean(s); page.drawText(c, { x: xr - f.widthOfTextAtSize(c, size), y: yy, size, font: f, color })
  }
  const hr = (yy: number, thick = 0.6, col = line) => page.drawLine({ start: { x: M, y: yy }, end: { x: width - M, y: yy }, thickness: thick, color: col })
  const wrap = (s: string, size: number, maxW: number, f: PDFFont = font): string[] => {
    const out: string[] = []
    for (const para of clean(s).split('\n')) {
      let ln = ''
      for (const w of para.split(' ')) {
        const test = ln ? ln + ' ' + w : w
        if (f.widthOfTextAtSize(clean(test), size) > maxW) { if (ln) out.push(ln); ln = w } else ln = test
      }
      out.push(ln)
    }
    return out
  }
  /** Dibuja una línea JUSTIFICADA: reparte el sobrante entre los espacios. Si el
   *  estiramiento sería excesivo (línea con muy pocas palabras) se deja a la izquierda. */
  const justifyLine = (words: string[], x: number, yy: number, size: number, maxW: number, f: PDFFont, color = dark) => {
    if (words.length < 2) { T(words[0] ?? '', x, yy, size, f, color); return }
    const wordsW = words.reduce((s, w) => s + f.widthOfTextAtSize(clean(w), size), 0)
    const extra = (maxW - wordsW) / (words.length - 1)
    const spaceW = f.widthOfTextAtSize(' ', size)
    if (extra <= 0 || extra > spaceW * 3.5) { T(words.join(' '), x, yy, size, f, color); return }
    let cx = x
    for (const w of words) { T(w, cx, yy, size, f, color); cx += f.widthOfTextAtSize(clean(w), size) + extra }
  }
  /** Bloque etiqueta + texto largo, justificado por párrafo, con paginación por línea. */
  const block = (label: string, value: string) => {
    const val = (value || '').trim() || '-'
    const size = 10.5, lineH = 14, maxW = width - 2 * M
    ensure(15 + lineH + 4) // etiqueta + al menos una línea juntas
    T(label.toUpperCase(), M, y, 8, bold, gray); y -= 15
    for (const para of clean(val).split('\n')) {
      const wordsAll = para.split(' ').filter(Boolean)
      if (!wordsAll.length) { y -= lineH * 0.5; continue }
      let lineWords: string[] = []
      for (const w of wordsAll) {
        const test = [...lineWords, w].join(' ')
        if (lineWords.length && font.widthOfTextAtSize(clean(test), size) > maxW) {
          ensure(lineH); justifyLine(lineWords, M, y, size, maxW, font, dark); y -= lineH
          lineWords = [w]
        } else lineWords.push(w)
      }
      // Última línea del párrafo: alineada a la izquierda (no se estira).
      if (lineWords.length) { ensure(lineH); T(lineWords.join(' '), M, y, size, font, dark); y -= lineH }
    }
    y -= 6
  }

  // ── Encabezado ──
  let nameX = M + 2
  if (logo) {
    const lh = 26, lw = (logo.width / logo.height) * lh
    page.drawImage(logo, { x: M, y: y - 17, width: lw, height: lh })
    nameX = M + lw + 12
  }
  T(brand.name, nameX, y, 15, bold, brandColor)
  R(d.statusLabel.toUpperCase(), width - M, y, 9, font, gray); y -= 13
  T('ACTA DE VISITA TÉCNICA', nameX, y, 8, font, gray); y -= 10
  hr(y, 1.4, dark); y -= 24

  T(d.visit_number, M, y, 14, bold, dark)
  R(d.typeLabel, width - M, y, 11, bold, brandColor); y -= 20
  const titleLines = wrap(d.title, 13, width - 2 * M)
  for (const ln of titleLines) { ensure(16); T(ln, M, y, 13, bold, dark); y -= 16 }
  y -= 10

  // ── Cliente / Técnico (dos columnas, cada texto envuelto en SU ancho) ──
  ensure(70)
  const gap = 24
  const halfW = (width - 2 * M - gap) / 2
  const colR = M + halfW + gap
  T('CLIENTE', M, y, 8, bold, gray)
  T('TÉCNICO', colR, y, 8, bold, gray); y -= 14
  let yL = y, yR = y
  for (const ln of wrap(d.client.name || '-', 11, halfW, bold)) { T(ln, M, yL, 11, bold, dark); yL -= 13 }
  if (d.client.address) for (const ln of wrap(d.client.address, 9, halfW)) { T(ln, M, yL, 9, font, gray); yL -= 11 }
  if (d.client.phone) { T(d.client.phone, M, yL, 9, font, gray); yL -= 11 }
  for (const ln of wrap(d.technician.name || '-', 11, halfW)) { T(ln, colR, yR, 11, font, dark); yR -= 13 }
  if (d.technician.email) for (const ln of wrap(d.technician.email, 9, halfW)) { T(ln, colR, yR, 9, font, gray); yR -= 11 }
  y = Math.min(yL, yR) - 8

  // ── Datos de la visita ──
  ensure(70)
  const grid: [string, string][] = [
    ['Sitio', d.site || '-'], ['Contacto en sitio', d.contact || '-'], ['Programada', d.scheduled || '-'],
    ['Llegada', d.started || '-'], ['Salida', d.ended || '-'], ['Materiales / repuestos', d.materials || '-'],
  ]
  const cw = (width - 2 * M) / 3
  for (let i = 0; i < grid.length; i += 3) {
    // Alto de fila según la celda más alta (hasta 2 líneas), sin recortar la fecha.
    let rowLines = 1
    const cells = grid.slice(i, i + 3).map(([lab, val]) => {
      const vls = wrap(val, 9.5, cw - 10).slice(0, 2)
      rowLines = Math.max(rowLines, vls.length)
      return { lab, vls }
    })
    const rowH = 14 + rowLines * 11 + 6
    ensure(rowH)
    cells.forEach(({ lab, vls }, j) => {
      const x = M + j * cw
      T(lab.toUpperCase(), x, y, 7.5, bold, gray)
      let vy = y - 12
      for (const vl of vls) { T(vl, x, vy, 9.5, font, dark); vy -= 11 }
    })
    y -= rowH
  }
  y -= 4
  hr(y + 6); y -= 10

  // ── Contenido ──
  block('Trabajo realizado', d.work_performed || '')
  block('Hallazgos', d.findings || '')
  block('Recomendaciones', d.recommendations || '')

  // ── Evidencia fotográfica ──
  if (d.images.length) {
    ensure(20)
    T('EVIDENCIA FOTOGRÁFICA', M, y, 8, bold, gray); y -= 14
    const iw = (width - 2 * M - 2 * 8) / 3, ih = iw * 0.72
    let col = 0, rowX = M
    for (const img of d.images) {
      let embedded
      try {
        embedded = img.mime.includes('png') ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes)
      } catch { continue }
      if (col === 0) ensure(ih + 8)
      const x = rowX + col * (iw + 8)
      page.drawImage(embedded, { x, y: y - ih, width: iw, height: ih })
      col++
      if (col === 3) { col = 0; y -= ih + 8; rowX = M }
    }
    if (col !== 0) y -= ih + 8
    y -= 6
  }

  // ── Firma — solo el técnico responsable ──
  ensure(50)
  y -= 24
  const centerIn = (s: string, x0: number, w: number, yy: number, size: number, f: PDFFont, color = dark) => {
    const c = clean(s); page.drawText(c, { x: x0 + (w - f.widthOfTextAtSize(c, size)) / 2, y: yy, size, font: f, color })
  }
  const sigW = 240
  const sigX = (width - sigW) / 2
  page.drawLine({ start: { x: sigX, y }, end: { x: sigX + sigW, y }, thickness: 0.8, color: gray })
  y -= 12
  centerIn(d.technician.name || '', sigX, sigW, y, 10, font, dark)
  y -= 11
  centerIn('Técnico responsable', sigX, sigW, y, 8, font, gray)

  // ── Pie ──
  T(`${brand.name} · ${d.visit_number} · Generado ${d.generatedAt}`, M, M - 16, 8, font, gray)

  return Buffer.from(await doc.save())
}
