import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Brand } from '@/lib/email/branding'
import type { ReportData } from './data'
import { formatMoney } from '@/lib/format/currency'

function clean(s: string): string {
  return (s ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2022]/g, '-')
    .replace(/[^\x00-\xFF]/g, '?')
}
export async function buildReportPdf(brand: Brand, d: ReportData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const PW = 595.28, PH = 841.89, M = 42
  const dark = rgb(0.043, 0.145, 0.271)
  const gray = rgb(0.357, 0.42, 0.486)
  const light = rgb(0.9, 0.93, 0.96)
  const cw = PW - 2 * M

  let page: PDFPage = doc.addPage([PW, PH])
  let y = PH - M
  const ensure = (h: number) => { if (y - h < M) { page = doc.addPage([PW, PH]); y = PH - M } }
  const T = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color = dark) => page.drawText(clean(s), { x, y: yy, size, font: f, color })
  const R = (s: string, xr: number, yy: number, size: number, f: PDFFont = font, color = dark) => { const c = clean(s); page.drawText(c, { x: xr - f.widthOfTextAtSize(c, size), y: yy, size, font: f, color }) }
  const money = (n: number) => clean(formatMoney(n, 'COP'))

  // ── Encabezado ──
  page.drawRectangle({ x: 0, y: PH - 70, width: PW, height: 70, color: dark })
  T(brand.name, M, PH - 34, 17, bold, rgb(1, 1, 1))
  T(`REPORTE DE GESTION  ·  ${d.orgLabel}`, M, PH - 52, 9, font, rgb(0.7, 0.78, 0.86))
  R(`${d.range.from}  a  ${d.range.to}`, PW - M, PH - 40, 10, font, rgb(1, 1, 1))
  y = PH - 70 - 24

  // ── KPIs (grid 4 col) ──
  const kpis: [string, string][] = [
    ['Tickets', String(d.kpis.total)], ['Abiertos', String(d.kpis.open)],
    ['Resueltos', String(d.kpis.resolved)], ['SLA cumplido', `${d.kpis.slaCompliance}%`],
    ['Resolucion prom.', `${d.kpis.avgResolutionHrs}h`], ['1a respuesta', d.kpis.avgFirstRespMin ? `${d.kpis.avgFirstRespMin}m` : '-'],
    ['CSAT', d.kpis.avgCsat ? `${d.kpis.avgCsat}/5` : '-'], ['Ingreso neto', money(d.kpis.netRevenue)],
    ['Gastos', money(d.kpis.totalExpenses)], ['Margen', money(d.kpis.margin)],
  ]
  const cols = 4, gap = 8, bw = (cw - gap * (cols - 1)) / cols, bh = 44
  kpis.forEach((kp, i) => {
    const col = i % cols
    if (col === 0) { ensure(bh + gap); }
    const x = M + col * (bw + gap)
    const yy = y - bh
    page.drawRectangle({ x, y: yy, width: bw, height: bh, color: rgb(0.965, 0.976, 0.988), borderColor: light, borderWidth: 0.5 })
    T(kp[0].toUpperCase(), x + 8, yy + bh - 14, 7, font, gray)
    T(kp[1], x + 8, yy + 10, 14, bold, dark)
    if (col === cols - 1 || i === kpis.length - 1) y -= bh + gap
  })
  y -= 6

  // ── Tabla genérica ──
  const table = (title: string, headers: string[], rows: string[][], widths: number[], aligns: ('l' | 'r')[]) => {
    if (!rows.length) return
    ensure(30)
    T(title, M, y, 11, bold, dark); y -= 16
    // header
    page.drawRectangle({ x: M, y: y - 4, width: cw, height: 18, color: dark })
    let hx = M
    headers.forEach((h, i) => {
      if (aligns[i] === 'r') R(h, hx + widths[i] - 6, y, 8, bold, rgb(1, 1, 1))
      else T(h, hx + 6, y, 8, bold, rgb(1, 1, 1))
      hx += widths[i]
    })
    y -= 20
    rows.forEach((rowc, ri) => {
      ensure(15)
      if (ri % 2 === 1) page.drawRectangle({ x: M, y: y - 4, width: cw, height: 15, color: rgb(0.97, 0.98, 0.99) })
      let x = M
      rowc.forEach((cell, i) => {
        if (aligns[i] === 'r') R(cell, x + widths[i] - 6, y, 8.5, font, dark)
        else T(String(cell).slice(0, 46), x + 6, y, 8.5, font, dark)
        x += widths[i]
      })
      y -= 15
    })
    y -= 12
  }

  table('Finanzas por mes', ['Mes', 'Ingresos', 'Gastos', 'Margen'],
    d.financeMonthly.map(m => [m.month, money(m.ingresos), money(m.gastos), money(m.margen)]),
    [cw * 0.28, cw * 0.24, cw * 0.24, cw * 0.24], ['l', 'r', 'r', 'r'])

  table('Tickets: creados vs resueltos', ['Mes', 'Creados', 'Resueltos'],
    d.monthly.map(m => [m.month, String(m.creados), String(m.resueltos)]),
    [cw * 0.5, cw * 0.25, cw * 0.25], ['l', 'r', 'r'])

  table('Top clientes por ingreso neto', ['Cliente', 'Ingreso neto', 'Tickets'],
    d.topClients.map(c => [c.name, money(c.revenue), String(c.tickets)]),
    [cw * 0.5, cw * 0.3, cw * 0.2], ['l', 'r', 'r'])

  table('Desempeno por agente', ['Agente', 'Asign.', 'Cerr.', 'Cierre', 'CSAT'],
    d.agents.map(a => [a.name, String(a.total), String(a.closed), `${a.closeRate}%`, a.avgCsat !== null ? a.avgCsat.toFixed(1) : '-']),
    [cw * 0.4, cw * 0.15, cw * 0.15, cw * 0.15, cw * 0.15], ['l', 'r', 'r', 'r', 'r'])

  // Pie de cada página
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    p.drawText(clean(`${brand.name} · Reporte generado · pagina ${i + 1} de ${pages.length}`), { x: M, y: 22, size: 7.5, font, color: gray })
  })

  return Buffer.from(await doc.save())
}
