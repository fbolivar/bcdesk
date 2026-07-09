import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { formatMoney } from '@/lib/format/currency'
import { fmtDateOnly } from '@/lib/date'
import { INVOICE_CONTACT_EMAIL } from '@/lib/invoices/doc-type'
import type { Brand } from '@/lib/email/branding'

export type InvoicePdfData = {
  invoice_number: string
  docLabel: string
  status: string
  issue_date: string
  due_date: string
  currency: string
  subtotal_usd: number
  tax_percent: number
  tax_usd: number
  total_usd: number
  notes: string | null
  ticket_number?: number | null
}
export type InvoicePdfOrg = { name?: string | null; address?: string | null; phone?: string | null }
export type InvoicePdfItem = { description: string; quantity: number; unit_price_usd: number; total_usd: number }

const STATUS: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviada', paid: 'Pagada', overdue: 'Vencida', cancelled: 'Cancelada',
}

/** Sustituye caracteres fuera de Latin-1 (StandardFonts sólo soporta WinAnsi). */
function clean(s: string): string {
  return (s ?? '')
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[•]/g, '-')
    .replace(/[^\x00-\xFF]/g, '?')
}

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return rgb(0.09, 0.537, 0.988)
  const n = parseInt(m[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export async function buildInvoicePdf(
  brand: Brand, invoice: InvoicePdfData, org: InvoicePdfOrg, items: InvoicePdfItem[],
): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page: PDFPage = doc.addPage([595.28, 841.89]) // A4
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()

  const M = 50
  const dark = rgb(0.043, 0.145, 0.271)
  const gray = rgb(0.357, 0.42, 0.486)
  const line = rgb(0.9, 0.92, 0.95)
  const brandColor = hexToRgb(brand.color)
  const money = (n: number) => clean(formatMoney(n, invoice.currency))

  const T = (s: string, x: number, y: number, size: number, f: PDFFont = font, color = dark) =>
    page.drawText(clean(s), { x, y, size, font: f, color })
  const R = (s: string, xr: number, y: number, size: number, f: PDFFont = font, color = dark) => {
    const c = clean(s)
    page.drawText(c, { x: xr - f.widthOfTextAtSize(c, size), y, size, font: f, color })
  }
  const hr = (y: number, thick = 0.5) =>
    page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: thick, color: line })

  let y = height - M

  // ── Encabezado ──
  T(brand.name, M, y, 18, bold, brandColor)
  R((invoice.docLabel || 'Cuenta de cobro').toUpperCase(), width - M, y, 14, bold, dark)
  y -= 15
  T(brand.tagline, M, y, 8, font, gray)
  R(invoice.invoice_number, width - M, y, 11, font, gray)
  y -= 13
  R('Estado: ' + (STATUS[invoice.status] ?? invoice.status), width - M, y, 9, font, gray)
  y -= 18
  hr(y, 1)
  y -= 22

  // ── Facturado a / Detalles ──
  const top = y
  T('FACTURADO A', M, y, 8, bold, gray); y -= 14
  T(org.name ?? '', M, y, 11, bold, dark); y -= 13
  if (org.address) { T(org.address, M, y, 9, font, gray); y -= 12 }
  if (org.phone) { T(org.phone, M, y, 9, font, gray); y -= 12 }
  if (invoice.ticket_number) { T('Servicio: Ticket #' + invoice.ticket_number, M, y, 9, font, brandColor); y -= 12 }

  let ry = top
  const rLabel = width - M - 190
  T('Fecha de emisión', rLabel, ry, 9, font, gray); R(fmtDateOnly(invoice.issue_date), width - M, ry, 9, font, dark); ry -= 14
  T('Vencimiento', rLabel, ry, 9, font, gray); R(fmtDateOnly(invoice.due_date), width - M, ry, 9, font, dark); ry -= 14

  y = Math.min(y, ry) - 18

  // ── Tabla de ítems ──
  page.drawRectangle({ x: M, y: y - 6, width: width - 2 * M, height: 20, color: rgb(0.957, 0.969, 0.984) })
  const colQty = width - M - 200
  const colUnit = width - M - 90
  T('DESCRIPCIÓN', M + 6, y, 8, bold, gray)
  R('CANT.', colQty, y, 8, bold, gray)
  R('P. UNIT.', colUnit, y, 8, bold, gray)
  R('TOTAL', width - M - 6, y, 8, bold, gray)
  y -= 22

  for (const it of items) {
    T(it.description.slice(0, 58), M + 6, y, 9, font, dark)
    R(String(it.quantity), colQty, y, 9, font, gray)
    R(money(it.unit_price_usd), colUnit, y, 9, font, gray)
    R(money(it.total_usd), width - M - 6, y, 9, font, dark)
    y -= 16
    hr(y + 5)
  }
  y -= 12

  // ── Totales ──
  const lblX = width - M - 90
  R('Subtotal', lblX, y, 9, font, gray); R(money(invoice.subtotal_usd), width - M, y, 9, font, dark); y -= 14
  if (invoice.tax_percent > 0) {
    R(`IVA (${invoice.tax_percent}%)`, lblX, y, 9, font, gray); R(money(invoice.tax_usd), width - M, y, 9, font, dark); y -= 14
  }
  page.drawLine({ start: { x: lblX - 20, y: y + 5 }, end: { x: width - M, y: y + 5 }, thickness: 0.8, color: line })
  y -= 6
  R('TOTAL', lblX, y, 11, bold, dark); R(money(invoice.total_usd), width - M, y, 11, bold, dark)
  y -= 26

  // ── Notas ──
  if (invoice.notes) {
    T('NOTAS', M, y, 8, bold, gray); y -= 13
    const maxW = width - 2 * M
    for (const word of invoice.notes.split('\n')) {
      let lineStr = ''
      for (const w of word.split(' ')) {
        const test = lineStr ? lineStr + ' ' + w : w
        if (font.widthOfTextAtSize(clean(test), 9) > maxW) { T(lineStr, M, y, 9, font, gray); y -= 12; lineStr = w }
        else lineStr = test
      }
      if (lineStr) { T(lineStr, M, y, 9, font, gray); y -= 12 }
    }
  }

  // ── Pie ──
  T(`${brand.name} · ${INVOICE_CONTACT_EMAIL} · ${brand.website.replace(/^https?:\/\//, '')}`, M, M - 12, 8, font, gray)

  return Buffer.from(await doc.save())
}
