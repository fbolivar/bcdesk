import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
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
function clean(s: string): string {
  return (s ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2022]/g, '-')
    .replace(/[^\x00-\xFF]/g, '?')
}
function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return rgb(0.09, 0.537, 0.988)
  const n = parseInt(m[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

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
  const wrap = (s: string, size: number, maxW: number): string[] => {
    const out: string[] = []
    for (const para of clean(s).split('\n')) {
      let ln = ''
      for (const w of para.split(' ')) {
        const test = ln ? ln + ' ' + w : w
        if (font.widthOfTextAtSize(clean(test), size) > maxW) { if (ln) out.push(ln); ln = w } else ln = test
      }
      out.push(ln)
    }
    return out
  }
  /** Bloque etiqueta + texto largo (con wrap y paginación). */
  const block = (label: string, value: string) => {
    const val = (value || '').trim() || '-'
    const lines = wrap(val, 10.5, width - 2 * M)
    ensure(16 + lines.length * 13 + 6)
    T(label.toUpperCase(), M, y, 8, bold, gray); y -= 13
    for (const ln of lines) { T(ln, M, y, 10.5, font, dark); y -= 13 }
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

  // ── Cliente / Técnico ──
  ensure(60)
  const colR = M + (width - 2 * M) / 2 + 10
  T('CLIENTE', M, y, 8, bold, gray)
  T('TÉCNICO', colR, y, 8, bold, gray); y -= 13
  T(d.client.name || '-', M, y, 11, bold, dark)
  T(d.technician.name || '-', colR, y, 11, font, dark); y -= 12
  let yL = y, yR = y
  if (d.client.address) { T(d.client.address, M, yL, 9, font, gray); yL -= 11 }
  if (d.client.phone) { T(d.client.phone, M, yL, 9, font, gray); yL -= 11 }
  if (d.technician.email) { T(d.technician.email, colR, yR, 9, font, gray); yR -= 11 }
  y = Math.min(yL, yR) - 8

  // ── Datos de la visita ──
  ensure(70)
  const grid: [string, string][] = [
    ['Sitio', d.site || '-'], ['Contacto en sitio', d.contact || '-'], ['Programada', d.scheduled || '-'],
    ['Llegada', d.started || '-'], ['Salida', d.ended || '-'], ['Materiales / repuestos', d.materials || '-'],
  ]
  const cw = (width - 2 * M) / 3
  for (let i = 0; i < grid.length; i += 3) {
    ensure(28)
    for (let j = 0; j < 3 && i + j < grid.length; j++) {
      const [lab, val] = grid[i + j]
      const x = M + j * cw
      T(lab.toUpperCase(), x, y, 7.5, bold, gray)
      T(clean(val).slice(0, 34), x, y - 12, 9.5, font, dark)
    }
    y -= 30
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

  // ── Firmas ──
  ensure(50)
  y -= 24
  const half = (width - 2 * M) / 2
  const centerIn = (s: string, x0: number, w: number, yy: number, size: number, f: PDFFont, color = dark) => {
    const c = clean(s); page.drawText(c, { x: x0 + (w - f.widthOfTextAtSize(c, size)) / 2, y: yy, size, font: f, color })
  }
  page.drawLine({ start: { x: M, y }, end: { x: M + half - 20, y }, thickness: 0.8, color: gray })
  page.drawLine({ start: { x: M + half + 20, y }, end: { x: width - M, y }, thickness: 0.8, color: gray })
  y -= 12
  centerIn(d.technician.name || '', M, half - 20, y, 10, font, dark)
  centerIn(d.client_signoff || '', M + half + 20, half - 20, y, 10, font, dark)
  y -= 11
  centerIn('Técnico responsable', M, half - 20, y, 8, font, gray)
  centerIn('Conformidad del cliente', M + half + 20, half - 20, y, 8, font, gray)

  // ── Pie ──
  T(`${brand.name} · ${d.visit_number} · Generado ${d.generatedAt}`, M, M - 16, 8, font, gray)

  return Buffer.from(await doc.save())
}
