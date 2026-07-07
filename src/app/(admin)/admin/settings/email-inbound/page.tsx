'use client'

import { useState } from 'react'
import { Mail, Copy, CheckCircle2, Zap, Key, Globe, AlertCircle } from 'lucide-react'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'
const webhookUrl = `${appUrl}/api/email/inbound`

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(23,137,252,0.15)',
        color: copied ? '#10B981' : '#1789FC',
      }}
    >
      {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

type TestResult = {
  ok: boolean
  ticket?: { id: string; ticket_number: string; title: string }
  error?: string
  status?: number
}

export default function EmailInboundPage() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  async function handleTest() {
    setTesting(true)
    setResult(null)
    try {
      const secret = prompt('Ingresa el valor de EMAIL_INBOUND_SECRET (deja vacío si no está configurado):') ?? ''
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (secret) headers['x-webhook-secret'] = secret

      const res = await fetch('/api/email/inbound', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: 'Test User <test@example.com>',
          subject: '[Prueba] Email Inbound - HexDesk',
          text: 'Este es un ticket de prueba generado desde la configuración de Email Inbound.',
          to: 'soporte@bcfabric.co',
        }),
      })

      const data = (await res.json()) as TestResult
      setResult({ ...data, status: res.status })
    } catch {
      setResult({ ok: false, error: 'Error de red al conectar con el endpoint' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Email Inbound</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">
          Convierte emails entrantes en tickets automáticamente usando Resend Inbound
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-[#1789FC]/10 border border-[#1789FC]/20 rounded-xl">
        <Zap size={14} className="text-[#1789FC] shrink-0 mt-0.5" />
        <p className="text-xs text-[#5B6B7C] leading-relaxed">
          Resend Inbound reenvía los correos recibidos en tu dominio a este webhook.
          Cada email crea un ticket nuevo. Si el remitente tiene cuenta en HexDesk,
          el ticket se asocia a su organización automáticamente.
        </p>
      </div>

      {/* Webhook URL */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-[#1789FC]" />
          <h2 className="text-sm font-semibold text-[#0B2545]">URL del Webhook</h2>
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg">
          <code className="flex-1 text-xs text-[#5B6B7C] font-mono break-all">{webhookUrl}</code>
          <CopyButton value={webhookUrl} />
        </div>
        <p className="text-xs text-[#5B6B7C]">
          Pega esta URL en{' '}
          <a
            href="https://resend.com/inbound"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1789FC] hover:underline"
          >
            resend.com/inbound
          </a>{' '}
          al configurar tu ruta de email entrante.
        </p>
      </div>

      {/* Setup steps */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail size={15} className="text-[#1789FC]" />
          <h2 className="text-sm font-semibold text-[#0B2545]">Configuración en Resend</h2>
        </div>
        <ol className="space-y-3 text-sm text-[#5B6B7C]">
          {[
            <>Ve a <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-[#1789FC] hover:underline">resend.com/domains</a> y verifica tu dominio.</>,
            <>En el panel de tu dominio, abre la pestaña <strong className="text-[#0B2545]">Inbound</strong>.</>,
            <>Crea una nueva ruta de entrada con el prefijo que prefieras, por ejemplo <code className="bg-[#F4F7FB] px-1 rounded text-[#5B6B7C] text-xs">soporte@tudominio.com</code>.</>,
            <>En el campo <strong className="text-[#0B2545]">Webhook URL</strong>, pega la URL del recuadro de arriba.</>,
            <>Activa la ruta y envía un email de prueba para verificar.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                style={{ background: 'rgba(23,137,252,0.15)', color: '#1789FC' }}
              >
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Secret key */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key size={15} className="text-[#1789FC]" />
          <h2 className="text-sm font-semibold text-[#0B2545]">Secret de seguridad</h2>
        </div>
        <p className="text-xs text-[#5B6B7C] leading-relaxed">
          El endpoint valida el header <code className="bg-[#F4F7FB] px-1 rounded text-xs">x-webhook-secret</code> contra la variable de entorno{' '}
          <code className="bg-[#F4F7FB] px-1 rounded text-xs">EMAIL_INBOUND_SECRET</code>.
          Agrega esta línea a tu <code className="bg-[#F4F7FB] px-1 rounded text-xs">.env.local</code> (y en las variables de entorno de producción):
        </p>
        <div className="flex items-center gap-3 px-3 py-2.5 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg">
          <code className="flex-1 text-xs text-[#5B6B7C] font-mono">
            EMAIL_INBOUND_SECRET=change_me_in_production
          </code>
          <CopyButton value="EMAIL_INBOUND_SECRET=change_me_in_production" />
        </div>
        <div className="flex items-start gap-2 px-3 py-2.5 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg">
          <AlertCircle size={13} className="text-[#F59E0B] shrink-0 mt-0.5" />
          <p className="text-xs text-[#5B6B7C]">
            Cambia <strong className="text-[#0B2545]">change_me_in_production</strong> por un valor aleatorio seguro antes de publicar.
            Puedes generar uno con <code className="bg-[#F4F7FB] px-1 rounded">openssl rand -hex 32</code>.
          </p>
        </div>
      </div>

      {/* Test button */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#0B2545]">Probar webhook</h2>
        <p className="text-xs text-[#5B6B7C]">
          Envía una petición de prueba al endpoint y crea un ticket de ejemplo.
        </p>
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: '#1789FC', color: '#fff' }}
          onMouseEnter={e => { if (!testing) (e.currentTarget as HTMLButtonElement).style.background = '#0B72D6' }}
          onMouseLeave={e => { if (!testing) (e.currentTarget as HTMLButtonElement).style.background = '#1789FC' }}
        >
          <Zap size={14} />
          {testing ? 'Enviando...' : 'Probar webhook'}
        </button>

        {result && (
          <div
            className="px-4 py-3 rounded-lg border text-sm"
            style={
              result.ok
                ? { background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)', color: '#10B981' }
                : { background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', color: '#EF4444' }
            }
          >
            {result.ok ? (
              <span>
                Ticket creado:{' '}
                <strong>#{result.ticket?.ticket_number}</strong> — {result.ticket?.title}
              </span>
            ) : (
              <span>
                Error {result.status ? `(${result.status})` : ''}: {result.error}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
