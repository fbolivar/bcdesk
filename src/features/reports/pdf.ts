import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Brand } from '@/lib/email/branding'
import type { ReportData } from './data'
import { formatMoney } from '@/lib/format/currency'
import { embedLogo } from '@/lib/pdf/logo'

export type ReportAudience = 'internal' | 'client'

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
function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return rgb(0.09, 0.537, 0.988)
  const n = parseInt(m[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export async function buildReportPdf(brand: Brand, d: ReportData, audience: ReportAudience = 'internal'): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const PW = 595.28, PH = 841.89, M = 42
  const dark = rgb(0.13, 0.17, 0.23)       // gris azulado oscuro para texto (sin azul fuerte)
  const gray = rgb(0.42, 0.47, 0.53)
  const faint = rgb(0.62, 0.66, 0.71)
  const hairline = rgb(0.88, 0.9, 0.93)
  const zebra = rgb(0.975, 0.98, 0.985)
  const headFill = rgb(0.955, 0.965, 0.975)
  const accent = hexToRgb(brand.color)
  const isClient = audience === 'client'
  const cw = PW - 2 * M

  let page: PDFPage = doc.addPage([PW, PH])
  let y = PH - M
  const ensure = (h: number) => { if (y - h < M + 16) { page = doc.addPage([PW, PH]); y = PH - M } }
  const T = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color = dark) => page.drawText(clean(s), { x, y: yy, size, font: f, color })
  const R = (s: string, xr: number, yy: number, size: number, f: PDFFont = font, color = dark) => { const c = clean(s); page.drawText(c, { x: xr - f.widthOfTextAtSize(c, size), y: yy, size, font: f, color }) }
  const money = (n: number) => clean(formatMoney(n, 'COP'))

  // ── Encabezado (fondo blanco, acento sutil) ──
  const logo = await embedLogo(doc, brand.logoUrl)
  const top = PH - M
  let hx = M
  if (logo) {
    const lh = 34, lw = (logo.width / logo.height) * lh
    page.drawImage(logo, { x: M, y: top - lh, width: lw, height: lh })
    hx = M + lw + 14
  }
  const title = isClient ? 'REPORTE DE SERVICIO' : 'REPORTE DE GESTION'
  T(brand.name, hx, top - 14, 16, bold, dark)
  T(`${title}  ·  ${d.orgLabel}`, hx, top - 28, 8.5, font, gray)
  R(`${d.range.from}  a  ${d.range.to}`, PW - M, top - 14, 9.5, font, gray)
  R('Periodo', PW - M, top - 26, 7, font, faint)
  y = top - 44
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1.4, color: accent })
  y -= 22

  // ── KPIs ──
  const opKpis: [string, string][] = [
    ['Tickets', String(d.kpis.total)], ['Abiertos', String(d.kpis.open)],
    ['Resueltos', String(d.kpis.resolved)], ['SLA cumplido', `${d.kpis.slaCompliance}%`],
    ['Resolucion prom.', `${d.kpis.avgResolutionHrs}h`], ['1a respuesta', d.kpis.avgFirstRespMin ? `${d.kpis.avgFirstRespMin}m` : '-'],
    ['CSAT', d.kpis.avgCsat ? `${d.kpis.avgCsat}/5` : '-'],
  ]
  const finKpis: [string, string][] = [
    ['Ingreso neto', money(d.kpis.netRevenue)], ['Gastos', money(d.kpis.totalExpenses)], ['Margen', money(d.kpis.margin)],
  ]
  const kpis = isClient ? opKpis : [...opKpis, ...finKpis]
  const cols = 4, gap = 8, bw = (cw - gap * (cols - 1)) / cols, bh = 46
  kpis.forEach((kp, i) => {
    const col = i % cols
    if (col === 0) ensure(bh + gap)
    const x = M + col * (bw + gap)
    const yy = y - bh
    page.drawRectangle({ x, y: yy, width: bw, height: bh, color: rgb(0.985, 0.99, 0.995), borderColor: hairline, borderWidth: 0.7 })
    page.drawRectangle({ x, y: yy, width: 3, height: bh, color: accent }) // acento lateral
    T(kp[0].toUpperCase(), x + 10, yy + bh - 15, 7, font, gray)
    T(kp[1], x + 10, yy + 11, 15, bold, dark)
    if (col === cols - 1 || i === kpis.length - 1) y -= bh + gap
  })
  y -= 8

  // ── Tabla genérica (encabezado claro) ──
  const table = (heading: string, headers: string[], rows: string[][], widths: number[], aligns: ('l' | 'r')[]) => {
    if (!rows.length) return
    ensure(34)
    // Título de sección con marca de acento
    page.drawRectangle({ x: M, y: y - 2, width: 3, height: 11, color: accent })
    T(heading, M + 9, y, 11, bold, dark); y -= 16
    // Fila de encabezado clara
    page.drawRectangle({ x: M, y: y - 4, width: cw, height: 18, color: headFill })
    let cx = M
    headers.forEach((h, i) => {
      if (aligns[i] === 'r') R(h, cx + widths[i] - 6, y, 8, bold, gray)
      else T(h, cx + 6, y, 8, bold, gray)
      cx += widths[i]
    })
    page.drawLine({ start: { x: M, y: y - 5 }, end: { x: PW - M, y: y - 5 }, thickness: 0.8, color: hairline })
    y -= 20
    rows.forEach((rowc, ri) => {
      ensure(15)
      if (ri % 2 === 1) page.drawRectangle({ x: M, y: y - 4, width: cw, height: 15, color: zebra })
      let x = M
      rowc.forEach((cell, i) => {
        if (aligns[i] === 'r') R(cell, x + widths[i] - 6, y, 8.5, font, dark)
        else T(String(cell).slice(0, 46), x + 6, y, 8.5, font, dark)
        x += widths[i]
      })
      y -= 15
    })
    y -= 14
  }

  // Tendencia de tickets (ambos)
  table('Tickets: creados vs resueltos', ['Mes', 'Creados', 'Resueltos'],
    d.monthly.map(m => [m.month, String(m.creados), String(m.resueltos)]),
    [cw * 0.5, cw * 0.25, cw * 0.25], ['l', 'r', 'r'])

  // Distribuciones (ambos)
  table('Tickets por estado', ['Estado', 'Cantidad'],
    d.byStatus.map(s => [s.label, String(s.count)]), [cw * 0.7, cw * 0.3], ['l', 'r'])
  table('Tickets por prioridad', ['Prioridad', 'Cantidad'],
    d.byPriority.map(p => [p.label, String(p.count)]), [cw * 0.7, cw * 0.3], ['l', 'r'])
  table('Tickets por categoria', ['Categoria', 'Cantidad'],
    d.byCategory.map(c => [c.name, String(c.value)]), [cw * 0.7, cw * 0.3], ['l', 'r'])

  // Solo informe INTERNO: finanzas, top clientes y agentes
  if (!isClient) {
    table('Finanzas por mes', ['Mes', 'Ingresos', 'Gastos', 'Margen'],
      d.financeMonthly.map(m => [m.month, money(m.ingresos), money(m.gastos), money(m.margen)]),
      [cw * 0.28, cw * 0.24, cw * 0.24, cw * 0.24], ['l', 'r', 'r', 'r'])
    table('Top clientes por ingreso neto', ['Cliente', 'Ingreso neto', 'Tickets'],
      d.topClients.map(c => [c.name, money(c.revenue), String(c.tickets)]),
      [cw * 0.5, cw * 0.3, cw * 0.2], ['l', 'r', 'r'])
    table('Desempeno por agente', ['Agente', 'Asign.', 'Cerr.', 'Cierre', 'CSAT'],
      d.agents.map(a => [a.name, String(a.total), String(a.closed), `${a.closeRate}%`, a.avgCsat !== null ? a.avgCsat.toFixed(1) : '-']),
      [cw * 0.4, cw * 0.15, cw * 0.15, cw * 0.15, cw * 0.15], ['l', 'r', 'r', 'r', 'r'])
  }

  // ── Pie ──
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 34 }, end: { x: PW - M, y: 34 }, thickness: 0.6, color: hairline })
    p.drawText(clean(`${brand.name}`), { x: M, y: 22, size: 7.5, font, color: gray })
    const rt = clean(`Pagina ${i + 1} de ${pages.length}`)
    p.drawText(rt, { x: PW - M - font.widthOfTextAtSize(rt, 7.5), y: 22, size: 7.5, font, color: faint })
  })

  return Buffer.from(await doc.save())
}
