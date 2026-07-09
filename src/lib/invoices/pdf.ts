import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { formatMoney } from '@/lib/format/currency'
import type { Brand } from '@/lib/email/branding'

export type InvoicePdfIssuer = {
  name?: string | null; role?: string | null; cc?: string | null; cc_city?: string | null
  email?: string | null; phone?: string | null; city?: string | null
  bank_name?: string | null; bank_account_type?: string | null; bank_account_number?: string | null
  bank_holder?: string | null; bank_holder_cc?: string | null
}
export type InvoicePdfClient = { name?: string | null; tax_id?: string | null; address?: string | null }
export type InvoicePdfItem = { description: string; quantity: number; unit_price_usd: number; total_usd: number }

export type InvoicePdfData = {
  docLabel: string
  isCuentaCobro: boolean
  invoice_number: string
  status: string
  issueDateLong: string
  dueDateLong: string
  currency: string
  subtotal_usd: number
  tax_percent: number
  tax_usd: number
  total_usd: number
  notes: string | null
  totalWords: string
  ticket_number?: number | null
  client: InvoicePdfClient
  issuer: InvoicePdfIssuer
  declarations: string[]
  items: InvoicePdfItem[]
}

/** Sustituye caracteres fuera de Latin-1 (StandardFonts sólo soporta WinAnsi). */
function clean(s: string): string {
  return (s ?? '').replace(/[—–]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[•]/g, '-').replace(/[^\x00-\xFF]/g, '?')
}
function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return rgb(0.09, 0.537, 0.988)
  const n = parseInt(m[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export async function buildInvoicePdf(brand: Brand, d: InvoicePdfData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page: PDFPage = doc.addPage([595.28, 841.89])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()

  const M = 50
  const dark = rgb(0.043, 0.145, 0.271)
  const gray = rgb(0.357, 0.42, 0.486)
  const line = rgb(0.8, 0.84, 0.89)
  const brandColor = hexToRgb(brand.color)
  const money = (n: number) => clean(formatMoney(n, d.currency))
  const iss = d.issuer

  const T = (s: string, x: number, y: number, size: number, f: PDFFont = font, color = dark) => page.drawText(clean(s), { x, y, size, font: f, color })
  const R = (s: string, xr: number, y: number, size: number, f: PDFFont = font, color = dark) => {
    const c = clean(s); page.drawText(c, { x: xr - f.widthOfTextAtSize(c, size), y, size, font: f, color })
  }
  const C = (s: string, y: number, size: number, f: PDFFont = font, color = dark) => {
    const c = clean(s); page.drawText(c, { x: (width - f.widthOfTextAtSize(c, size)) / 2, y, size, font: f, color })
  }
  const hr = (y: number, thick = 0.6, col = line) => page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: thick, color: col })
  /** Envuelve texto a un ancho. */
  const wrap = (s: string, size: number, maxW: number): string[] => {
    const out: string[] = []
    for (const para of (s || '').split('\n')) {
      let ln = ''
      for (const w of para.split(' ')) {
        const test = ln ? ln + ' ' + w : w
        if (font.widthOfTextAtSize(clean(test), size) > maxW) { if (ln) out.push(ln); ln = w } else ln = test
      }
      out.push(ln)
    }
    return out
  }

  let y = height - M

  // ── Encabezado emisor ──
  T(iss.name || brand.name, M + 2, y, 15, bold, brandColor)
  R((d.status === 'paid' ? 'PAGADA' : d.status === 'draft' ? 'BORRADOR' : 'EMITIDA'), width - M, y, 9, font, gray)
  y -= 13
  T((iss.role || brand.tagline).toUpperCase(), M + 2, y, 8, font, gray)
  y -= 10
  hr(y, 1.4, dark)
  y -= 26

  if (d.isCuentaCobro) {
    T(`CUENTA DE COBRO No. ${d.invoice_number}`, M, y, 16, bold, dark); y -= 15
    T(`${iss.city || 'Bogotá D.C., Colombia'}, ${d.issueDateLong}`, M, y, 10, font, gray); y -= 26

    T((d.client.name || '').toUpperCase(), M, y, 11, bold, dark); y -= 13
    T(`NIT / C.C.: ${d.client.tax_id || '________'}`, M, y, 9, font, gray); y -= 12
    T(`Dirección: ${d.client.address || '________'}`, M, y, 9, font, gray); y -= 26

    C('DEBE A', y, 10, bold, dark); y -= 15
    C((iss.name || brand.name).toUpperCase(), y, 11, bold, dark); y -= 13
    C(`C.C. ${iss.cc || '________'}${iss.cc_city ? ` de ${iss.cc_city}` : ''}`, y, 9, font, gray); y -= 26

    // Tabla concepto
    page.drawRectangle({ x: M, y: y - 6, width: width - 2 * M, height: 20, color: dark })
    T('Concepto', M + 6, y, 9, bold, rgb(1, 1, 1))
    R('Valor (COP)', width - M - 6, y, 9, bold, rgb(1, 1, 1))
    y -= 22
    for (const it of d.items) {
      const desc = it.description + (it.quantity > 1 ? ` (x${it.quantity})` : '')
      for (const ln of wrap(desc, 9, width - 2 * M - 150)) { T(ln, M + 6, y, 9, font, dark); y -= 13 }
      // valor alineado con la primera línea del concepto
      R(money(it.total_usd), width - M - 6, y + 13, 9, font, dark)
      hr(y + 5)
    }
    if (d.tax_percent > 0) { T(`IVA (${d.tax_percent}%)`, M + 6, y, 9, font, dark); R(money(d.tax_usd), width - M - 6, y, 9, font, dark); y -= 13; hr(y + 5) }
    T('VALOR TOTAL', M + 6, y, 10, bold, dark); R(money(d.total_usd), width - M - 6, y, 10, bold, dark); y -= 18
    T(`Son: ${d.totalWords}`, M, y, 9, bold, dark); y -= 22

    if (d.declarations.length) {
      T('Declaraciones', M, y, 10, bold, dark); y -= 14
      for (const dec of d.declarations) {
        const lns = wrap(dec, 8.5, width - 2 * M - 12)
        T('-', M, y, 8.5, font, gray); T(lns[0], M + 10, y, 8.5, font, gray); y -= 11
        for (const ln of lns.slice(1)) { T(ln, M + 10, y, 8.5, font, gray); y -= 11 }
        y -= 2
      }
      y -= 8
    }

    T('Datos para el pago', M, y, 10, bold, dark); y -= 14
    T(`Banco: ${iss.bank_name || '________'}   ·   Tipo de cuenta: ${iss.bank_account_type || '________'}   ·   No.: ${iss.bank_account_number || '________'}`, M, y, 9, font, gray); y -= 12
    T(`Titular: ${iss.bank_holder || iss.name || ''}${iss.bank_holder_cc ? ` - C.C. ${iss.bank_holder_cc}` : ''}`, M, y, 9, font, gray); y -= 20
  } else {
    // Documento genérico (factura / otro)
    R(d.docLabel.toUpperCase(), width - M, y, 16, bold, dark)
    T('FACTURADO A', M, y, 8, bold, gray); y -= 14
    T((d.client.name || '').toUpperCase(), M, y, 11, bold, dark)
    R(d.invoice_number, width - M, y, 11, font, gray); y -= 12
    if (d.client.tax_id) { T(`NIT/C.C.: ${d.client.tax_id}`, M, y, 9, font, gray); R(`Emisión: ${d.issueDateLong}`, width - M, y, 9, font, gray); y -= 12 }
    if (d.client.address) { T(d.client.address, M, y, 9, font, gray); y -= 12 }
    R(`Vence: ${d.dueDateLong}`, width - M, y, 9, font, gray); y -= 20
    page.drawRectangle({ x: M, y: y - 6, width: width - 2 * M, height: 20, color: rgb(0.957, 0.969, 0.984) })
    T('DESCRIPCIÓN', M + 6, y, 8, bold, gray); R('CANT.', width - M - 200, y, 8, bold, gray); R('P. UNIT.', width - M - 90, y, 8, bold, gray); R('TOTAL', width - M - 6, y, 8, bold, gray); y -= 22
    for (const it of d.items) {
      T(it.description.slice(0, 58), M + 6, y, 9, font, dark); R(String(it.quantity), width - M - 200, y, 9, font, gray)
      R(money(it.unit_price_usd), width - M - 90, y, 9, font, gray); R(money(it.total_usd), width - M - 6, y, 9, font, dark); y -= 16; hr(y + 5)
    }
    y -= 8
    R('Subtotal   ' + money(d.subtotal_usd), width - M, y, 9, font, gray); y -= 13
    if (d.tax_percent > 0) { R(`IVA (${d.tax_percent}%)   ` + money(d.tax_usd), width - M, y, 9, font, gray); y -= 13 }
    R('TOTAL   ' + money(d.total_usd), width - M, y, 11, bold, dark); y -= 20
  }

  if (d.notes) { T('Notas: ' + d.notes, M, y, 9, font, gray); y -= 14 }

  // ── Pie ──
  T(`${iss.name || brand.name} · ${iss.email || brand.supportEmail} · ${iss.phone || ''} · ${iss.city || ''}`, M, M - 14, 8, font, gray)

  return Buffer.from(await doc.save())
}
