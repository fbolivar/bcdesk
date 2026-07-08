'use client'

import { FileDown, Printer } from 'lucide-react'

export type ExportRow = {
  ticket_number: number | null
  created_at: string
  requester_email: string | null
  category: string | null
  priority: string | null
  status: string | null
  first_response_at: string | null
  resolved_at: string | null
  sla_breached: boolean | null
}

export function EmailExportButtons({ rows, kpis }: { rows: ExportRow[]; kpis: { label: string; value: string }[] }) {
  function downloadCsv() {
    const headers = ['Ticket', 'Creado', 'Remitente', 'Categoria', 'Prioridad', 'Estado', '1ra_respuesta', 'Resuelto', 'SLA_incumplido']
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }
    const lines = [headers.join(',')]
    for (const r of rows) {
      lines.push([
        r.ticket_number ?? '', r.created_at, r.requester_email ?? '', r.category ?? '', r.priority ?? '',
        r.status ?? '', r.first_response_at ?? '', r.resolved_at ?? '', r.sla_breached ? 'si' : 'no',
      ].map(esc).join(','))
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `metricas-correo-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf() {
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    const kpiHtml = kpis.map(k => `<div class="kpi"><div class="v">${k.value}</div><div class="l">${k.label}</div></div>`).join('')
    const rowsHtml = rows.slice(0, 500).map(r =>
      `<tr><td>#${r.ticket_number ?? ''}</td><td>${new Date(r.created_at).toLocaleString('es-CO')}</td><td>${r.requester_email ?? ''}</td><td>${r.category ?? ''}</td><td>${r.priority ?? ''}</td><td>${r.status ?? ''}</td></tr>`,
    ).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Métricas de correo</title>
      <style>
        body{font-family:system-ui,-apple-system,sans-serif;color:#0B2545;padding:24px;margin:0}
        h1{font-size:18px;margin:0 0 4px} .sub{color:#5B6B7C;font-size:12px;margin:0 0 16px}
        .kpis{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 18px}
        .kpi{border:1px solid #E6EBF2;border-radius:8px;padding:10px 14px;min-width:120px}
        .kpi .v{font-size:20px;font-weight:700} .kpi .l{font-size:11px;color:#5B6B7C;margin-top:2px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border-bottom:1px solid #E6EBF2;text-align:left;padding:6px 8px}
        th{color:#5B6B7C;font-weight:600}
      </style></head><body>
      <h1>Métricas de correo</h1>
      <p class="sub">Generado el ${new Date().toLocaleString('es-CO')} · ${rows.length} tickets</p>
      <div class="kpis">${kpiHtml}</div>
      <table><thead><tr><th>Ticket</th><th>Creado</th><th>Remitente</th><th>Categoría</th><th>Prioridad</th><th>Estado</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
      </body></html>`)
    w.document.close()
  }

  return (
    <div className="flex gap-2">
      <button onClick={downloadCsv}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#E6EBF2] text-[#5B6B7C] bg-[#FFFFFF] hover:text-[#0B2545] hover:bg-[#F4F7FB] transition-colors">
        <FileDown size={14} /> CSV
      </button>
      <button onClick={exportPdf}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#E6EBF2] text-[#5B6B7C] bg-[#FFFFFF] hover:text-[#0B2545] hover:bg-[#F4F7FB] transition-colors">
        <Printer size={14} /> PDF
      </button>
    </div>
  )
}
