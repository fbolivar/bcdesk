import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { cleanPdfText as clean, hexToRgbPdf as hexToRgb } from '@/lib/pdf/text'
import type { Brand } from '@/lib/email/branding'
import { embedLogo } from '@/lib/pdf/logo'

export type ContractReportData = {
  contract: { name: string; contract_type: string; start_date: string; end_date: string; included_hours: number; notes?: string | null }
  client: { name: string; legal_name?: string | null; tax_id?: string | null; address?: string | null }
  issuer: { name?: string | null; role?: string | null; cc?: string | null; cc_city?: string | null; city?: string | null; email?: string | null; phone?: string | null }
  period: { from: string; to: string }
  activities: { activity_date: string; description: string; hours: number; obligation?: string | null; result?: string | null }[]
  summary: { tickets: number; resolved: number; slaCompliance: number; visits: number; totalHours: number }
  generatedAt: string
}

// clean() -> @/lib/pdf/text
// hexToRgb() -> @/lib/pdf/text
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function fechaLarga(d: string): string {
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number)
  if (!y || !m || !day) return String(d)
  return `${String(day).padStart(2, '0')} de ${MESES[m - 1]} de ${y}`
}
const dmy = (d: string) => { const [y, m, dd] = String(d).slice(0, 10).split('-'); return dd && m && y ? `${dd}/${m}/${y}` : String(d) }
const TYPE_LABEL: Record<string, string> = { support: 'Soporte', maintenance: 'Mantenimiento', managed: 'Managed Services', project: 'Proyecto' }

export async function buildContractReportPdf(brand: Brand, d: ContractReportData): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const PW = 595.28, PH = 841.89, M = 42
  const dark = rgb(0.13, 0.17, 0.23)
  const gray = rgb(0.42, 0.47, 0.53)
  const faint = rgb(0.62, 0.66, 0.71)
  const hairline = rgb(0.88, 0.9, 0.93)
  const soft = rgb(0.975, 0.98, 0.985)
  const accent = hexToRgb(brand.color)
  const cw = PW - 2 * M

  let page: PDFPage = doc.addPage([PW, PH])
  let y = PH - M
  const ensure = (h: number) => { if (y - h < M + 18) { page = doc.addPage([PW, PH]); y = PH - M } }
  const T = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color = dark) => page.drawText(clean(s), { x, y: yy, size, font: f, color })
  const R = (s: string, xr: number, yy: number, size: number, f: PDFFont = font, color = dark) => { const c = clean(s); page.drawText(c, { x: xr - f.widthOfTextAtSize(c, size), y: yy, size, font: f, color }) }
  const wrap = (s: string, size: number, maxW: number, f: PDFFont = font): string[] => {
    const out: string[] = []
    for (const para of clean(s).split('\n')) {
      let ln = ''
      for (const w of para.split(' ')) {
        const test = ln ? ln + ' ' + w : w
        if (f.widthOfTextAtSize(test, size) > maxW) { if (ln) out.push(ln); ln = w } else ln = test
      }
      out.push(ln)
    }
    return out
  }

  // ── Encabezado ──
  const logo = await embedLogo(doc, brand.logoUrl)
  const top = PH - M
  let hx = M
  if (logo) { const lh = 34, lw = (logo.width / logo.height) * lh; page.drawImage(logo, { x: M, y: top - lh, width: lw, height: lh }); hx = M + lw + 14 }
  T(brand.name, hx, top - 14, 16, bold, dark)
  T('INFORME DE GESTION', hx, top - 28, 8.5, font, gray)
  R(`${dmy(d.period.from)}  a  ${dmy(d.period.to)}`, PW - M, top - 14, 9.5, font, gray)
  R('Periodo del informe', PW - M, top - 26, 7, font, faint)
  y = top - 44
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1.4, color: accent })
  y -= 20

  // Objeto del contrato
  T('OBJETO DEL CONTRATO', M, y, 8, bold, gray); y -= 13
  for (const ln of wrap(d.contract.name + (d.contract.notes ? ` - ${d.contract.notes}` : ''), 11, cw)) { ensure(14); T(ln, M, y, 11, font, dark); y -= 14 }
  y -= 8

  // ── Partes ──
  ensure(70)
  const colR = M + cw / 2 + 10
  T('CONTRATANTE', M, y, 8, bold, gray)
  T('CONTRATISTA', colR, y, 8, bold, gray); y -= 13
  T(d.client.legal_name || d.client.name, M, y, 10.5, bold, dark)
  T(d.issuer.name || brand.name, colR, y, 10.5, bold, dark); y -= 12
  let yL = y, yR = y
  const li = (s: string, x: number, yy: number) => { T(s, x, yy, 9, font, gray); return yy - 11 }
  if (d.client.tax_id) yL = li(`NIT/C.C.: ${d.client.tax_id}`, M, yL)
  if (d.client.address) yL = li(d.client.address, M, yL)
  if (d.issuer.cc) yR = li(`C.C. ${d.issuer.cc}${d.issuer.cc_city ? ` de ${d.issuer.cc_city}` : ''}`, colR, yR)
  if (d.issuer.role) yR = li(d.issuer.role, colR, yR)
  if (d.issuer.email) yR = li(d.issuer.email, colR, yR)
  y = Math.min(yL, yR) - 6

  // Datos del contrato (caja suave)
  ensure(40)
  page.drawRectangle({ x: M, y: y - 30, width: cw, height: 34, color: soft, borderColor: hairline, borderWidth: 0.6 })
  const dcx = [M + 10, M + cw * 0.33, M + cw * 0.62, M + cw * 0.82]
  const dcp: [string, string][] = [
    ['TIPO', TYPE_LABEL[d.contract.contract_type] ?? d.contract.contract_type],
    ['VIGENCIA', `${dmy(d.contract.start_date)} - ${dmy(d.contract.end_date)}`],
    ['HORAS CONTRATO', String(d.contract.included_hours ?? 0)],
    ['HORAS PERIODO', String(d.summary.totalHours)],
  ]
  dcp.forEach((p, i) => { T(p[0], dcx[i], y - 10, 6.5, bold, faint); T(p[1], dcx[i], y - 22, 9, font, dark) })
  y -= 44

  // ── Resumen del periodo ──
  T('RESUMEN DEL PERIODO', M, y, 9, bold, dark); y -= 16
  const kpis: [string, string][] = [
    ['Tickets atendidos', String(d.summary.tickets)], ['Resueltos', String(d.summary.resolved)],
    ['SLA cumplido', `${d.summary.slaCompliance}%`], ['Visitas', String(d.summary.visits)],
    ['Horas dedicadas', String(d.summary.totalHours)],
  ]
  const cols = 5, gap = 8, bw = (cw - gap * (cols - 1)) / cols, bh = 42
  kpis.forEach((kp, i) => {
    const x = M + i * (bw + gap), yy = y - bh
    page.drawRectangle({ x, y: yy, width: bw, height: bh, color: rgb(0.985, 0.99, 0.995), borderColor: hairline, borderWidth: 0.7 })
    page.drawRectangle({ x, y: yy, width: 3, height: bh, color: accent })
    for (const ln of wrap(kp[0], 6.5, bw - 14).slice(0, 2)) { T(ln.toUpperCase(), x + 8, yy + bh - 12, 6.5, font, gray) }
    T(kp[1], x + 8, yy + 9, 14, bold, dark)
  })
  y -= bh + 18

  // ── Actividades ejecutadas ──
  ensure(24)
  page.drawRectangle({ x: M, y: y - 2, width: 3, height: 11, color: accent })
  T('ACTIVIDADES EJECUTADAS', M + 9, y, 11, bold, dark); y -= 18

  if (!d.activities.length) {
    T('Sin actividades registradas en el periodo.', M, y, 9, font, faint); y -= 14
  }
  d.activities.forEach((a, idx) => {
    const descLines = wrap(a.description, 9, cw - 12)
    const resLines = a.result ? wrap(`Resultado: ${a.result}`, 8.5, cw - 12) : []
    const blockH = 16 + descLines.length * 11 + resLines.length * 10 + 10
    ensure(blockH)
    // Cabecera de la actividad
    T(`${idx + 1}. ${dmy(a.activity_date)}`, M, y, 9, bold, dark)
    if (a.obligation) T(clean(a.obligation).slice(0, 60), M + 90, y, 8, font, gray)
    R(`${a.hours} h`, PW - M, y, 8.5, bold, accent)
    y -= 13
    for (const ln of descLines) { T(ln, M + 8, y, 9, font, dark); y -= 11 }
    for (const ln of resLines) { T(ln, M + 8, y, 8.5, font, gray); y -= 10 }
    page.drawLine({ start: { x: M, y: y - 2 }, end: { x: PW - M, y: y - 2 }, thickness: 0.5, color: hairline })
    y -= 10
  })
  y -= 6

  // ── Firmas ──
  ensure(60)
  y -= 26
  const half = cw / 2
  const centerIn = (s: string, x0: number, w: number, yy: number, size: number, f: PDFFont, color = dark) => { const c = clean(s); page.drawText(c, { x: x0 + (w - f.widthOfTextAtSize(c, size)) / 2, y: yy, size, font: f, color }) }
  page.drawLine({ start: { x: M, y }, end: { x: M + half - 20, y }, thickness: 0.8, color: gray })
  page.drawLine({ start: { x: M + half + 20, y }, end: { x: PW - M, y }, thickness: 0.8, color: gray })
  y -= 12
  centerIn(d.issuer.name || brand.name, M, half - 20, y, 10, font, dark)
  centerIn(d.client.legal_name || d.client.name, M + half + 20, half - 20, y, 10, font, dark)
  y -= 11
  centerIn('Contratista', M, half - 20, y, 8, font, gray)
  centerIn('Contratante / Supervisor', M + half + 20, half - 20, y, 8, font, gray)

  // ── Pie ──
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 34 }, end: { x: PW - M, y: 34 }, thickness: 0.6, color: hairline })
    p.drawText(clean(`${brand.name} - Informe generado ${fechaLarga(d.generatedAt)}`), { x: M, y: 22, size: 7.5, font, color: gray })
    const rt = clean(`Pagina ${i + 1} de ${pages.length}`)
    p.drawText(rt, { x: PW - M - font.widthOfTextAtSize(rt, 7.5), y: 22, size: 7.5, font, color: faint })
  })

  return Buffer.from(await doc.save())
}
