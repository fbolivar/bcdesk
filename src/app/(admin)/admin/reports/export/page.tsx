'use client'

import { useState } from 'react'
import { Download, FileText, FileJson } from 'lucide-react'

export default function ExportPage() {
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [loading, setLoading] = useState(false)

  function buildUrl() {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (priority) params.set('priority', priority)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    params.set('format', format)
    return `/api/export/tickets?${params.toString()}`
  }

  async function handleExport() {
    setLoading(true)
    const url = buildUrl()
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tickets.${format}`
    a.click()
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Exportar tickets</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Descarga tus datos en formato CSV o JSON</p>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Estado</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="">Todos</option>
              <option value="open">Abierto</option>
              <option value="in_progress">En progreso</option>
              <option value="resolved">Resuelto</option>
              <option value="closed">Cerrado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Prioridad</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="">Todas</option>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Desde</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Hasta</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-[#5B6B7C] mb-2">Formato</label>
          <div className="flex gap-3">
            {(['csv', 'json'] as const).map(f => (
              <button key={f} type="button" onClick={() => setFormat(f)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  format === f
                    ? 'bg-[#1789FC] border-[#1789FC] text-white'
                    : 'bg-[#F4F7FB] border-[#E6EBF2] text-[#5B6B7C] hover:border-[#CBD5E1]'
                }`}>
                {f === 'csv' ? <FileText size={14} /> : <FileJson size={14} />}
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button onClick={handleExport} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors disabled:opacity-50">
            <Download size={14} />
            {loading ? 'Exportando…' : `Descargar ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}
