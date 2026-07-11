import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Activity, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Check = { label: string; ok: boolean; enables: string; ifMissing: string }
type Group = { title: string; required: boolean; checks: Check[] }

export default async function SystemHealthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/dashboard')

  const env = process.env
  const has = (...keys: string[]) => keys.every(k => Boolean(env[k] && String(env[k]).trim()))
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? ''
  const appUrlOk = has('NEXT_PUBLIC_APP_URL') && !appUrl.includes('localhost') && !appUrl.includes('PENDIENTE')

  const groups: Group[] = [
    {
      title: 'Núcleo (requerido)', required: true,
      checks: [
        { label: 'Base de datos (Supabase URL)', ok: has('NEXT_PUBLIC_SUPABASE_URL'), enables: 'Conexión a la base de datos', ifMissing: 'La app no funciona' },
        { label: 'Clave pública (anon key)', ok: has('NEXT_PUBLIC_SUPABASE_ANON_KEY'), enables: 'Consultas del navegador con RLS', ifMissing: 'La app no carga datos' },
        { label: 'Clave de servicio (service role)', ok: has('SUPABASE_SERVICE_ROLE_KEY'), enables: 'Login, correos y crons (server)', ifMissing: 'Login y envíos fallan' },
        { label: 'Secreto JWT', ok: has('SUPABASE_JWT_SECRET'), enables: 'Firma de sesiones', ifMissing: 'Nadie puede iniciar sesión' },
        { label: 'Dominio de producción', ok: appUrlOk, enables: 'Enlaces en correos y checkout', ifMissing: 'Enlaces apuntan a localhost' },
        { label: 'Correo saliente (SMTP Gmail)', ok: has('GMAIL_USER', 'GMAIL_APP_PASSWORD'), enables: 'Actas, cuentas de cobro, avisos', ifMissing: 'No se envía ningún correo' },
        { label: 'Secreto de crons', ok: has('CRON_SECRET'), enables: 'Recordatorios y alertas de SLA diarias', ifMissing: 'Las automatizaciones no corren' },
      ],
    },
    {
      title: 'Opcionales (features extra)', required: false,
      checks: [
        { label: 'Notificaciones push (VAPID)', ok: has('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'), enables: 'Push a agentes y clientes', ifMissing: 'Solo llegan correos (sin push)' },
        { label: 'Inteligencia artificial', ok: has('ANTHROPIC_API_KEY') || has('OPENROUTER_API_KEY') || has('OPENAI_API_KEY'), enables: 'Asistente/IA en tickets', ifMissing: 'Funciones de IA desactivadas' },
        { label: 'Pago en línea (Stripe)', ok: has('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'), enables: 'Botón pagar en la cuenta de cobro', ifMissing: 'Cobro solo por transferencia' },
        { label: 'Correo entrante → ticket', ok: has('EMAIL_INBOUND_SECRET'), enables: 'Crear tickets desde correos', ifMissing: 'No se procesan correos entrantes' },
        { label: 'WhatsApp / multicanal', ok: has('WHATSAPP_VERIFY_TOKEN'), enables: 'Bandeja de WhatsApp', ifMissing: 'Canal WhatsApp desactivado' },
        { label: 'Firma de encuestas CSAT', ok: has('CSAT_SECRET'), enables: 'Puntajes CSAT protegidos', ifMissing: 'Usa un secreto por defecto (inseguro)' },
      ],
    },
  ]

  const coreOk = groups[0].checks.filter(c => c.ok).length
  const coreTotal = groups[0].checks.length
  const allCoreOk = coreOk === coreTotal

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Activity size={20} className="text-[#0E9E86]" />
        <div>
          <h1 className="text-xl font-semibold text-[#0B2545]">Estado del sistema</h1>
          <p className="text-sm text-[#5B6B7C] mt-0.5">Qué integraciones están configuradas en este entorno</p>
        </div>
      </div>

      <div className="rounded-xl p-4 border" style={{ background: allCoreOk ? '#10B98110' : '#EF444410', borderColor: allCoreOk ? '#10B98140' : '#EF444440' }}>
        <p className="text-sm font-semibold" style={{ color: allCoreOk ? '#10B981' : '#EF4444' }}>
          {allCoreOk ? '✓ Listo para producción' : '✗ Faltan requisitos del núcleo'} · Núcleo {coreOk}/{coreTotal}
        </p>
        <p className="text-xs text-[#5B6B7C] mt-1">
          {allCoreOk
            ? 'Todo lo esencial está configurado. Las opcionales de abajo solo habilitan features extra.'
            : 'Completa las variables faltantes del núcleo en Vercel → Settings → Environment Variables y vuelve a desplegar.'}
        </p>
      </div>

      {groups.map(g => (
        <div key={g.title} className="bg-white border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E6EBF2]">
            <h2 className="text-sm font-semibold text-[#0B2545]">{g.title}</h2>
          </div>
          <div className="divide-y divide-[#E6EBF2]/60">
            {g.checks.map(c => (
              <div key={c.label} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0B2545]">{c.label}</p>
                  <p className="text-xs text-[#5B6B7C] mt-0.5">{c.ok ? c.enables : c.ifMissing}</p>
                </div>
                {c.ok ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[#10B981]"><CheckCircle2 size={14} /> Configurado</span>
                ) : g.required ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[#EF4444]"><XCircle size={14} /> Falta</span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[#F59E0B]"><AlertTriangle size={14} /> Desactivado</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-[11px] text-[#94A3B8]">Este panel solo indica si cada variable está presente; nunca muestra su valor. Cámbialas en Vercel → Settings → Environment Variables (requiere redeploy).</p>
    </div>
  )
}
