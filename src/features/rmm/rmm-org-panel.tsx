'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { MonitorDot, Plus, Copy, Check, AlertTriangle, Power, Loader2, RefreshCw, Download } from 'lucide-react'

type Endpoint = {
  id: string
  hostname: string | null
  os: string | null
  status: string
  last_seen_at: string | null
  disabled_at: string | null
  online: boolean
  latest: { cpu_pct: number | null; ram_pct: number | null; disk_free_pct: number | null } | null
}

type Install = { server_url: string; config_path: string; config_contents: string; note: string }

function rel(iso: string | null): string {
  if (!iso) return 'nunca'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'hace segundos'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} d`
}
const pct = (v: number | null | undefined) => (v == null ? '—' : `${Number(v).toFixed(0)}%`)

export function RmmOrgPanel({ organizationId, initialEnabled }: { organizationId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [busyToggle, setBusyToggle] = useState(false)
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [hostname, setHostname] = useState('')
  const [os, setOs] = useState<'windows' | 'linux'>('windows')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [install, setInstall] = useState<Install | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [installer, setInstaller] = useState<{ endpointId: string; url: string; filename: string; os: string; expiresAt: string } | null>(null)
  const [genBusy, setGenBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/endpoints`)
      const j = await res.json()
      if (res.ok) setEndpoints(j.endpoints ?? [])
      else setError(j.error ?? 'No se pudieron cargar los endpoints')
    } catch { setError('Error de red') } finally { setLoading(false) }
  }, [organizationId])

  useEffect(() => { if (enabled) load() }, [enabled, load])

  async function toggle() {
    setBusyToggle(true); setError(null)
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/rmm-toggle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !enabled }),
      })
      const j = await res.json()
      if (res.ok) setEnabled(j.rmm_enabled)
      else setError(j.error ?? 'No se pudo cambiar el módulo')
    } catch { setError('Error de red') } finally { setBusyToggle(false) }
  }

  async function createEndpoint() {
    if (creating) return
    setCreating(true); setError(null); setNewToken(null); setInstall(null)
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/endpoints`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: hostname.trim() || null, os }),
      })
      const j = await res.json()
      if (res.ok) {
        setNewToken(j.token); setInstall(j.install); setShowAdd(false)
        load()
        // Auto-genera el instalador del nuevo endpoint (es 'pending', sin advertencia).
        genInstaller({ id: j.endpoint.id, os, status: 'pending', hostname: hostname.trim() || null }, true)
        setHostname('')
      } else setError(j.error ?? 'No se pudo crear el endpoint')
    } catch { setError('Error de red') } finally { setCreating(false) }
  }

  async function genInstaller(ep: { id: string; os: string | null; status: string; hostname: string | null }, force = false) {
    if (!force && ep.status !== 'pending') {
      if (!confirm(`Este equipo (${ep.hostname ?? ep.id}) ya está activo. Generar un instalador nuevo invalidará el token actual y el agente instalado dejará de reportar. ¿Continuar?`)) return
    }
    setGenBusy(ep.id); setError(null)
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/endpoints/${ep.id}/installer`, { method: 'POST' })
      const j = await res.json()
      if (res.ok) { setInstaller({ endpointId: ep.id, url: j.download_url, filename: j.filename, os: j.os, expiresAt: j.expires_at }); load() }
      else setError(j.error ?? 'No se pudo generar el instalador')
    } catch { setError('Error de red') } finally { setGenBusy(null) }
  }

  async function disableEndpoint(id: string) {
    if (!confirm('Deshabilitar este endpoint? El token queda invalidado y no se puede reactivar.')) return
    const res = await fetch(`/api/admin/endpoints/${id}/disable`, { method: 'POST' })
    if (res.ok) load()
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 2000) })
  }

  return (
    <div className="bg-white border border-[#E6EBF2] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MonitorDot size={18} className="text-[#0E9E86]" />
          <h2 className="text-sm font-semibold text-[#0B2545]">Módulo RMM (monitoreo remoto)</h2>
        </div>
        <button onClick={toggle} disabled={busyToggle}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            enabled ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#E6EBF2] text-[#5B6B7C]'}`}>
          {busyToggle ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
          {enabled ? 'Activo' : 'Inactivo'}
        </button>
      </div>

      {error && <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-3 py-2">{error}</p>}

      {/* Instalador listo (primario) */}
      {installer && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid #00D4AA' }}>
          <p className="text-sm font-semibold text-[#0B2545]">Instalador listo para {installer.os === 'windows' ? 'Windows' : 'Linux'}</p>
          <div className="flex flex-wrap items-center gap-2">
            <a href={installer.url} download={installer.filename}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium">
              <Download size={14} /> Descargar instalador
            </a>
            <button onClick={() => copy(installer.url, 'link')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E6EBF2] bg-white text-[#5B6B7C] text-sm">
              {copied === 'link' ? <Check size={14} className="text-[#10B981]" /> : <Copy size={14} />} Copiar link
            </button>
            <button onClick={() => setInstaller(null)} className="text-xs text-[#94A3B8] ml-auto">Cerrar</button>
          </div>
          <p className="text-[11px] text-[#5B6B7C]">
            Usa <b>una</b> de las dos: <b>Descargar</b> si estás en el equipo del cliente, o <b>Copiar link</b> para enviarlo por WhatsApp/correo.
            El link es de <b>un solo uso</b> y expira en <b>15 min</b> (una vez descargado, el archivo sirve siempre).
          </p>
          <p className="text-[11px] text-[#94A3B8]">
            {installer.os === 'windows'
              ? 'En el equipo: doble clic en el archivo .cmd descargado (pedirá permisos de administrador).'
              : 'En el equipo: sudo bash <archivo>.sh'}
          </p>
        </div>
      )}

      {!enabled && <p className="text-xs text-[#5B6B7C]">Actívalo para dar de alta equipos de este cliente y monitorearlos.</p>}

      {/* Token manual — alternativa secundaria (para reinstalar sin transferir archivo o debug) */}
      {newToken && install && (
        <details className="rounded-xl border border-[#E6EBF2] p-3 text-sm">
          <summary className="cursor-pointer text-xs text-[#5B6B7C] hover:text-[#0B2545]">Ver token / instrucciones manuales (alternativa)</summary>
          <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-[#0B2545]">Copia el token AHORA (no se vuelve a mostrar)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-[#E6EBF2] rounded px-2 py-1.5 break-all text-[#0B2545]">{newToken}</code>
            <button onClick={() => copy(newToken, 'tok')} className="p-1.5 rounded bg-white border border-[#E6EBF2] text-[#5B6B7C]">
              {copied === 'tok' ? <Check size={14} className="text-[#10B981]" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-[#5B6B7C]">Guárdalo en <code className="bg-white px-1 rounded">{install.config_path}</code>:</p>
          <div className="flex items-start gap-2">
            <pre className="flex-1 text-[11px] bg-white border border-[#E6EBF2] rounded px-2 py-1.5 overflow-x-auto text-[#0B2545]">{install.config_contents}</pre>
            <button onClick={() => copy(install.config_contents, 'cfg')} className="p-1.5 rounded bg-white border border-[#E6EBF2] text-[#5B6B7C]">
              {copied === 'cfg' ? <Check size={14} className="text-[#10B981]" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-[#B45309]">{install.note}</p>
          </div>
        </details>
      )}

      {enabled && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdd(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-xs font-medium">
              <Plus size={13} /> Dar de alta endpoint
            </button>
            <button onClick={load} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E6EBF2] text-[#5B6B7C] text-xs">
              <RefreshCw size={12} /> Actualizar
            </button>
          </div>

          {showAdd && (
            <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2]">
              <div>
                <label className="block text-[11px] text-[#5B6B7C] mb-1">Nombre del equipo (opcional)</label>
                <input value={hostname} onChange={e => setHostname(e.target.value)} placeholder="PC-CONTABILIDAD"
                  className="px-3 py-1.5 bg-white border border-[#E6EBF2] rounded-lg text-sm text-[#0B2545] focus:outline-none focus:border-[#00D4AA]" />
              </div>
              <div>
                <label className="block text-[11px] text-[#5B6B7C] mb-1">Sistema</label>
                <select value={os} onChange={e => setOs(e.target.value as 'windows' | 'linux')}
                  className="px-3 py-1.5 bg-white border border-[#E6EBF2] rounded-lg text-sm text-[#0B2545] focus:outline-none focus:border-[#00D4AA]">
                  <option value="windows">Windows</option>
                  <option value="linux">Linux</option>
                </select>
              </div>
              <button onClick={createEndpoint} disabled={creating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B2545] text-white text-xs font-medium disabled:opacity-50">
                {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Generar token
              </button>
            </div>
          )}

          {/* Lista de endpoints */}
          {loading ? (
            <p className="text-xs text-[#5B6B7C]">Cargando…</p>
          ) : endpoints.length === 0 ? (
            <p className="text-xs text-[#5B6B7C]">Aún no hay equipos dados de alta.</p>
          ) : (
            <div className="border border-[#E6EBF2] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E6EBF2] text-left text-[11px] text-[#5B6B7C]">
                    <th className="px-3 py-2">Equipo</th><th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">CPU</th><th className="px-3 py-2 text-right">RAM</th>
                    <th className="px-3 py-2 text-right">Disco libre</th><th className="px-3 py-2">Visto</th><th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map(e => (
                    <tr key={e.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                      <td className="px-3 py-2">
                        <Link href={`/admin/rmm/endpoints/${e.id}`} className="font-medium text-[#0B2545] hover:text-[#0E9E86]">
                          {e.hostname ?? '(sin nombre)'}
                        </Link>
                        <span className="ml-1.5 text-[10px] text-[#94A3B8]">{e.os}</span>
                      </td>
                      <td className="px-3 py-2">
                        {e.disabled_at ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E6EBF2] text-[#5B6B7C]">Deshabilitado</span>
                        ) : e.online ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#10B981]"><span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />Online</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#94A3B8]"><span className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1]" />Offline</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-[#0B2545]">{pct(e.latest?.cpu_pct)}</td>
                      <td className="px-3 py-2 text-right text-[#0B2545]">{pct(e.latest?.ram_pct)}</td>
                      <td className="px-3 py-2 text-right text-[#0B2545]">{pct(e.latest?.disk_free_pct)}</td>
                      <td className="px-3 py-2 text-[11px] text-[#5B6B7C]">{rel(e.last_seen_at)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {!e.disabled_at && (
                          <>
                            <button onClick={() => genInstaller(e)} title="Descargar instalador" disabled={genBusy === e.id}
                              className="p-1 rounded text-[#5B6B7C] hover:text-[#0E9E86] hover:bg-[#0E9E86]/10 disabled:opacity-50">
                              {genBusy === e.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                            </button>
                            <button onClick={() => disableEndpoint(e.id)} title="Deshabilitar"
                              className="p-1 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10">
                              <AlertTriangle size={13} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
