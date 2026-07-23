import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { cleanPdfText as clean, hexToRgbPdf as hexToRgb } from '@/lib/pdf/text'
import type { Brand } from '@/lib/email/branding'
import { embedLogo } from '@/lib/pdf/logo'

export type RmmWindow = {
  uptime_pct: number | null
  alerts: { critical: number; high: number; medium: number; low: number; total: number }
  mttr_hours: number | null
  tickets: number
}
export type RmmReport = {
  orgLabel: string
  monthLabel: string
  current: RmmWindow
  previous: RmmWindow
  top3: { hostname: string | null; org: string; incidents: number }[]
}

// Flecha de tendencia. betterWhenUp: para uptime sube = bueno; para tickets/MTTR baja = bueno.
function delta(cur: number | null, prev: number | null, betterWhenUp: boolean): { txt: string; good: boolean | null } {
  if (cur == null || prev == null) return { txt: '—', good: null }
  const d = Math.round((cur - prev) * 10) / 10
  if (d === 0) return { txt: '=', good: null }
  const up = d > 0
  const good = betterWhenUp ? up : !up
  return { txt: `${up ? '+' : ''}${d}`, good }
}

export async function buildRmmReportPdf(brand: Brand, d: RmmReport): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const PW = 595.28, PH = 841.89, M = 42
  const dark = rgb(0.13, 0.17, 0.23)
  const gray = rgb(0.42, 0.47, 0.53)
  const faint = rgb(0.62, 0.66, 0.71)
  const hairline = rgb(0.88, 0.9, 0.93)
  const zebra = rgb(0.975, 0.98, 0.985)
  const headFill = rgb(0.955, 0.965, 0.975)
  const green = rgb(0.06, 0.72, 0.51)
  const red = rgb(0.94, 0.27, 0.27)
  const accent = hexToRgb(brand.color)
  const cw = PW - 2 * M

  let page: PDFPage = doc.addPage([PW, PH])
  let y = PH - M
  const ensure = (h: number) => { if (y - h < M + 16) { page = doc.addPage([PW, PH]); y = PH - M } }
  const T = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color = dark) => page.drawText(clean(s), { x, y: yy, size, font: f, color })
  const R = (s: string, xr: number, yy: number, size: number, f: PDFFont = font, color = dark) => { const c = clean(s); page.drawText(c, { x: xr - f.widthOfTextAtSize(c, size), y: yy, size, font: f, color }) }

  // ── Encabezado ──
  const logo = await embedLogo(doc, brand.logoUrl)
  const top = PH - M
  let hx = M
  if (logo) {
    const lh = 34, lw = (logo.width / logo.height) * lh
    page.drawImage(logo, { x: M, y: top - lh, width: lw, height: lh })
    hx = M + lw + 14
  }
  T(brand.name, hx, top - 14, 16, bold, dark)
  T(`REPORTE RMM MENSUAL  ·  ${d.orgLabel}`, hx, top - 28, 8.5, font, gray)
  R(d.monthLabel, PW - M, top - 14, 9.5, font, gray)
  R('Periodo', PW - M, top - 26, 7, font, faint)
  y = top - 44
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1.4, color: accent })
  y -= 24

  // ── KPIs con comparativo vs mes anterior ──
  const upt = delta(d.current.uptime_pct, d.previous.uptime_pct, true)
  const tkd = delta(d.current.tickets, d.previous.tickets, false)
  const mtd = delta(d.current.mttr_hours, d.previous.mttr_hours, false)
  const kpis: { label: string; value: string; delta: { txt: string; good: boolean | null } }[] = [
    { label: 'DISPONIBILIDAD', value: d.current.uptime_pct != null ? `${d.current.uptime_pct}%` : '—', delta: upt },
    { label: 'ALERTAS TOTALES', value: String(d.current.alerts.total), delta: tkd },
    { label: 'MTTR (HORAS)', value: d.current.mttr_hours != null ? `${d.current.mttr_hours}h` : '—', delta: mtd },
  ]
  const cols = 3, gap = 10, bw = (cw - gap * (cols - 1)) / cols, bh = 58
  kpis.forEach((kp, i) => {
    const x = M + i * (bw + gap)
    const yy = y - bh
    page.drawRectangle({ x, y: yy, width: bw, height: bh, color: rgb(0.985, 0.99, 0.995), borderColor: hairline, borderWidth: 0.7 })
    page.drawRectangle({ x, y: yy, width: 3, height: bh, color: accent })
    T(kp.label, x + 10, yy + bh - 15, 7, font, gray)
    T(kp.value, x + 10, yy + 18, 18, bold, dark)
    if (kp.delta.good !== null) {
      const col = kp.delta.good ? green : red
      T(`${kp.delta.txt} vs. mes anterior`, x + 10, yy + 8, 7.5, font, col)
    } else {
      T(`${kp.delta.txt} vs. mes anterior`, x + 10, yy + 8, 7.5, font, faint)
    }
  })
  y -= bh + 18

  // ── Veredicto de salud ──
  ensure(30)
  const verdictGood = (upt.good === true) || (tkd.good === true)
  const verdictBad = (upt.good === false) || (tkd.good === false)
  const verdict = d.previous.tickets === 0 && d.previous.uptime_pct == null
    ? 'Primer periodo con datos: sin mes anterior para comparar.'
    : verdictGood && !verdictBad ? 'La salud de la flota MEJORO respecto al mes anterior.'
    : verdictBad && !verdictGood ? 'La salud de la flota EMPEORO respecto al mes anterior.'
    : 'La salud de la flota se mantuvo ESTABLE respecto al mes anterior.'
  page.drawRectangle({ x: M, y: y - 4, width: 3, height: 11, color: accent })
  T(verdict, M + 9, y, 9.5, bold, verdictGood && !verdictBad ? green : verdictBad && !verdictGood ? red : gray)
  y -= 26

  const table = (heading: string, headers: string[], rows: string[][], widths: number[], aligns: ('l' | 'r')[]) => {
    ensure(34)
    page.drawRectangle({ x: M, y: y - 2, width: 3, height: 11, color: accent })
    T(heading, M + 9, y, 11, bold, dark); y -= 16
    page.drawRectangle({ x: M, y: y - 4, width: cw, height: 18, color: headFill })
    let cx = M
    headers.forEach((h, i) => {
      if (aligns[i] === 'r') R(h, cx + widths[i] - 6, y, 8, bold, gray)
      else T(h, cx + 6, y, 8, bold, gray)
      cx += widths[i]
    })
    page.drawLine({ start: { x: M, y: y - 5 }, end: { x: PW - M, y: y - 5 }, thickness: 0.8, color: hairline })
    y -= 20
    if (!rows.length) { T('Sin datos en el periodo.', M + 6, y, 8.5, font, faint); y -= 15 }
    rows.forEach((rowc, ri) => {
      ensure(15)
      if (ri % 2 === 1) page.drawRectangle({ x: M, y: y - 4, width: cw, height: 15, color: zebra })
      let x = M
      rowc.forEach((cell, i) => {
        if (aligns[i] === 'r') R(cell, x + widths[i] - 6, y, 8.5, font, dark)
        else T(String(cell).slice(0, 52), x + 6, y, 8.5, font, dark)
        x += widths[i]
      })
      y -= 15
    })
    y -= 14
  }

  // Alertas por severidad (actual vs anterior)
  const a = d.current.alerts, pa = d.previous.alerts
  table('Alertas por severidad', ['Severidad', 'Este mes', 'Mes anterior'], [
    ['Critica', String(a.critical), String(pa.critical)],
    ['Alta', String(a.high), String(pa.high)],
    ['Media', String(a.medium), String(pa.medium)],
    ['Baja', String(a.low), String(pa.low)],
    ['Total', String(a.total), String(pa.total)],
  ], [cw * 0.5, cw * 0.25, cw * 0.25], ['l', 'r', 'r'])

  // Top 3 equipos con más incidentes
  table('Top 3 equipos con mas incidentes', ['Equipo', 'Organizacion', 'Incidentes'],
    d.top3.map(e => [e.hostname ?? '(sin nombre)', e.org, String(e.incidents)]),
    [cw * 0.35, cw * 0.45, cw * 0.2], ['l', 'l', 'r'])

  // ── Pie ──
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 34 }, end: { x: PW - M, y: 34 }, thickness: 0.6, color: hairline })
    p.drawText(clean(`${brand.name}  ·  Reporte de monitoreo RMM`), { x: M, y: 22, size: 7.5, font, color: gray })
    const rt = clean(`Pagina ${i + 1} de ${pages.length}`)
    p.drawText(rt, { x: PW - M - font.widthOfTextAtSize(rt, 7.5), y: 22, size: 7.5, font, color: faint })
  })

  return Buffer.from(await doc.save())
}
