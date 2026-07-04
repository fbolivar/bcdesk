import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'API Reference — BCDesk',
  description: 'Documentación de la API REST de BCDesk v1',
}

// ─── Tipos internos ──────────────────────────────────────────────────────────

interface ParamRow {
  name: string
  type: string
  required: boolean
  description: string
}

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  description: string
  params?: ParamRow[]
  requestExample?: string
  responseExample: string
}

interface Section {
  id: string
  label: string
  endpoints?: Endpoint[]
}

// ─── Datos ───────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  { id: 'autenticacion', label: 'Autenticación' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'webhooks', label: 'Webhooks' },
]

const TICKET_ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/tickets',
    description: 'Devuelve la lista de tickets de tu organización (máx. 50 por solicitud).',
    params: [
      { name: 'status', type: 'string', required: false, description: 'Filtrar por estado: open | in_progress | waiting_client | resolved | closed' },
      { name: 'priority', type: 'string', required: false, description: 'Filtrar por prioridad: critical | high | medium | low' },
      { name: 'limit', type: 'number', required: false, description: 'Cantidad de resultados (máx. 50). Por defecto: 50.' },
    ],
    responseExample: `{
  "data": [
    {
      "id": "tk_01HXZ...",
      "subject": "Error al iniciar sesión",
      "status": "open",
      "priority": "high",
      "category": "support",
      "created_at": "2025-05-20T10:00:00Z",
      "updated_at": "2025-05-20T10:05:00Z"
    }
  ],
  "meta": { "count": 1 }
}`,
  },
  {
    method: 'POST',
    path: '/api/v1/tickets',
    description: 'Crea un nuevo ticket en tu organización.',
    params: [
      { name: 'subject', type: 'string', required: true, description: 'Asunto del ticket.' },
      { name: 'description', type: 'string', required: false, description: 'Descripción detallada del problema.' },
      { name: 'priority', type: 'string', required: false, description: 'Prioridad: critical | high | medium | low. Por defecto: medium.' },
      { name: 'category', type: 'string', required: false, description: 'Categoría: support | development | billing | onboarding | other. Por defecto: other.' },
    ],
    requestExample: `{
  "subject": "No puedo acceder al panel",
  "description": "Al ingresar con mi usuario obtengo un error 403.",
  "priority": "high",
  "category": "support"
}`,
    responseExample: `{
  "data": {
    "id": "tk_01HXZ...",
    "subject": "No puedo acceder al panel",
    "status": "open",
    "priority": "high",
    "category": "support",
    "created_at": "2025-05-20T10:00:00Z"
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/tickets/:id',
    description: 'Obtiene el detalle completo de un ticket por su ID.',
    params: [
      { name: 'id', type: 'string', required: true, description: 'ID del ticket (parámetro de ruta).' },
    ],
    responseExample: `{
  "data": {
    "id": "tk_01HXZ...",
    "subject": "No puedo acceder al panel",
    "description": "Al ingresar con mi usuario obtengo un error 403.",
    "status": "in_progress",
    "priority": "high",
    "category": "support",
    "created_at": "2025-05-20T10:00:00Z",
    "updated_at": "2025-05-20T10:30:00Z",
    "resolved_at": null
  }
}`,
  },
  {
    method: 'PATCH',
    path: '/api/v1/tickets/:id',
    description: 'Actualiza los campos de un ticket existente. Solo se modifican los campos enviados.',
    params: [
      { name: 'id', type: 'string', required: true, description: 'ID del ticket (parámetro de ruta).' },
      { name: 'subject', type: 'string', required: false, description: 'Nuevo asunto del ticket.' },
      { name: 'status', type: 'string', required: false, description: 'Nuevo estado: open | in_progress | waiting_client | resolved | closed.' },
      { name: 'priority', type: 'string', required: false, description: 'Nueva prioridad: critical | high | medium | low.' },
    ],
    requestExample: `{
  "status": "resolved",
  "priority": "medium"
}`,
    responseExample: `{
  "data": {
    "id": "tk_01HXZ...",
    "subject": "No puedo acceder al panel",
    "status": "resolved",
    "priority": "medium",
    "updated_at": "2025-05-20T11:00:00Z"
  }
}`,
  },
]

const CLIENT_ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/clients',
    description: 'Lista todos los clientes activos de tu organización.',
    responseExample: `{
  "data": [
    {
      "id": "usr_01HXZ...",
      "full_name": "María García",
      "email": "maria@empresa.com",
      "created_at": "2025-01-15T08:00:00Z"
    }
  ],
  "meta": { "count": 1 }
}`,
  },
]

const WEBHOOK_EVENTS = [
  { event: 'ticket.created', description: 'Se crea un nuevo ticket.' },
  { event: 'ticket.updated', description: 'Se actualiza el estado, prioridad u otro campo de un ticket.' },
  { event: 'ticket.resolved', description: 'Un ticket pasa al estado "resuelto".' },
  { event: 'ticket.closed', description: 'Un ticket es cerrado definitivamente.' },
  { event: 'ticket.comment_added', description: 'Se añade un nuevo comentario a un ticket.' },
]

// ─── Helpers de estilo ────────────────────────────────────────────────────────

const METHOD_STYLES: Record<Endpoint['method'], { bg: string; text: string }> = {
  GET:    { bg: 'rgba(16,185,129,0.15)',  text: '#10B981' },
  POST:   { bg: 'rgba(79,138,255,0.15)',  text: '#4F8AFF' },
  PATCH:  { bg: 'rgba(245,158,11,0.15)',  text: '#F59E0B' },
  DELETE: { bg: 'rgba(239,68,68,0.15)',   text: '#EF4444' },
}

function MethodBadge({ method }: { method: Endpoint['method'] }) {
  const s = METHOD_STYLES[method]
  return (
    <span
      className="inline-block text-[11px] font-bold px-2 py-0.5 rounded font-mono"
      style={{ background: s.bg, color: s.text }}
    >
      {method}
    </span>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre
      className="text-xs rounded-lg p-4 overflow-x-auto leading-relaxed"
      style={{
        background: '#0D1117',
        border: '1px solid #21262D',
        color: '#E6EDF3',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}
    >
      {code}
    </pre>
  )
}

function ParamsTable({ params }: { params: ParamRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid #E6EBF2' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: '#162032' }}>
            {['Nombre', 'Tipo', 'Requerido', 'Descripción'].map(h => (
              <th
                key={h}
                className="px-3 py-2 text-left font-semibold"
                style={{ color: '#64748B', borderBottom: '1px solid #E6EBF2' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr
              key={p.name}
              style={{
                background: i % 2 === 0 ? 'transparent' : '#FFFFFF',
                borderBottom: '1px solid rgba(51,65,85,0.5)',
              }}
            >
              <td className="px-3 py-2 font-mono font-medium" style={{ color: '#4F8AFF' }}>{p.name}</td>
              <td className="px-3 py-2 font-mono" style={{ color: '#64748B' }}>{p.type}</td>
              <td className="px-3 py-2">
                {p.required ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                    Sí
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#64748B' }}>No</span>
                )}
              </td>
              <td className="px-3 py-2" style={{ color: '#64748B' }}>{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EndpointBlock({ ep }: { ep: Endpoint }) {
  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: '#111827', border: '1px solid #EEF2F7' }}
    >
      {/* Method + path */}
      <div className="flex items-center gap-3 flex-wrap">
        <MethodBadge method={ep.method} />
        <code
          className="text-sm font-mono"
          style={{ color: '#1E293B', background: '#FFFFFF', padding: '2px 10px', borderRadius: '6px' }}
        >
          {ep.path}
        </code>
      </div>

      <p className="text-sm" style={{ color: '#64748B' }}>{ep.description}</p>

      {ep.params && ep.params.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
            Parámetros
          </p>
          <ParamsTable params={ep.params} />
        </div>
      )}

      {ep.requestExample && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
            Ejemplo de solicitud
          </p>
          <CodeBlock code={ep.requestExample} />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
          Ejemplo de respuesta
        </p>
        <CodeBlock code={ep.responseExample} />
      </div>
    </div>
  )
}

// ─── Secciones de contenido ───────────────────────────────────────────────────

function SectionAuth() {
  return (
    <section id="autenticacion" className="space-y-4 scroll-mt-20">
      <h2 className="text-lg font-semibold" style={{ color: '#1E293B' }}>Autenticación</h2>
      <p className="text-sm" style={{ color: '#64748B' }}>
        Todas las solicitudes a la API v1 deben incluir tu clave API en el header{' '}
        <code
          className="font-mono text-xs px-1.5 py-0.5 rounded"
          style={{ background: '#FFFFFF', color: '#4F8AFF' }}
        >
          x-api-key
        </code>
        . Puedes obtener tu clave en{' '}
        <Link
          href="/admin/settings"
          className="underline underline-offset-2 transition-colors"
          style={{ color: '#4F8AFF' }}
        >
          Configuración → API
        </Link>
        .
      </p>

      <div
        className="rounded-xl p-5 space-y-3"
        style={{ background: '#111827', border: '1px solid #EEF2F7' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
          Header requerido
        </p>
        <CodeBlock code={`x-api-key: tu_clave_secreta_aqui`} />

        <p className="text-xs font-semibold uppercase tracking-wider mt-2" style={{ color: '#64748B' }}>
          Ejemplo de solicitud cURL
        </p>
        <CodeBlock
          code={`curl https://tudominio.com/api/v1/tickets \\
  -H "x-api-key: tu_clave_secreta_aqui" \\
  -H "Content-Type: application/json"`}
        />
      </div>

      <div
        className="rounded-xl p-4 flex gap-3"
        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
      >
        <span style={{ color: '#F59E0B', fontSize: '16px' }}>⚠</span>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Mantén tu clave API en secreto. Si la expones accidentalmente, regenera una nueva desde el panel de configuración.
        </p>
      </div>
    </section>
  )
}

function SectionTickets() {
  return (
    <section id="tickets" className="space-y-5 scroll-mt-20">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: '#1E293B' }}>Tickets</h2>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>
          Gestiona tickets de soporte: lista, crea y actualiza.
        </p>
      </div>
      {TICKET_ENDPOINTS.map(ep => (
        <EndpointBlock key={ep.method + ep.path} ep={ep} />
      ))}
    </section>
  )
}

function SectionClients() {
  return (
    <section id="clientes" className="space-y-5 scroll-mt-20">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: '#1E293B' }}>Clientes</h2>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>
          Consulta los clientes registrados en tu organización.
        </p>
      </div>
      {CLIENT_ENDPOINTS.map(ep => (
        <EndpointBlock key={ep.method + ep.path} ep={ep} />
      ))}
    </section>
  )
}

function SectionWebhooks() {
  const payloadExample = `{
  "event": "ticket.created",
  "timestamp": "2025-05-20T10:00:00Z",
  "data": {
    "id": "tk_01HXZ...",
    "subject": "Error al iniciar sesión",
    "status": "open",
    "priority": "high",
    "category": "support",
    "created_at": "2025-05-20T10:00:00Z"
  }
}`

  return (
    <section id="webhooks" className="space-y-5 scroll-mt-20">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: '#1E293B' }}>Webhooks</h2>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>
          Configura webhooks para recibir notificaciones en tiempo real cuando ocurran eventos en BCDesk.
          Puedes registrar tu URL de webhook desde{' '}
          <Link
            href="/admin/settings/integrations"
            className="underline underline-offset-2"
            style={{ color: '#4F8AFF' }}
          >
            Configuración → Integraciones
          </Link>
          .
        </p>
      </div>

      {/* Eventos disponibles */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid #EEF2F7' }}
      >
        <div
          className="px-4 py-3"
          style={{ background: '#162032', borderBottom: '1px solid #EEF2F7' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
            Eventos disponibles
          </p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: '#111827' }}>
              {['Evento', 'Cuándo se dispara'].map(h => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left font-semibold"
                  style={{ color: '#64748B', borderBottom: '1px solid #EEF2F7' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEBHOOK_EVENTS.map((ev, i) => (
              <tr
                key={ev.event}
                style={{
                  background: i % 2 === 0 ? 'transparent' : '#FFFFFF',
                  borderBottom: '1px solid rgba(31,41,55,0.5)',
                }}
              >
                <td className="px-4 py-2.5 font-mono font-medium" style={{ color: '#4F8AFF' }}>{ev.event}</td>
                <td className="px-4 py-2.5" style={{ color: '#64748B' }}>{ev.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Estructura del payload */}
      <div
        className="rounded-xl p-5 space-y-3"
        style={{ background: '#111827', border: '1px solid #EEF2F7' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
          Estructura del payload
        </p>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Cada evento envía una solicitud <code className="font-mono text-xs px-1 rounded" style={{ background: '#FFFFFF', color: '#4F8AFF' }}>POST</code> a tu URL con el siguiente formato JSON:
        </p>
        <CodeBlock code={payloadExample} />
      </div>
    </section>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen" style={{ background: '#EEF1F6' }}>
      {/* Encabezado */}
      <div
        className="sticky top-0 z-20 px-6 h-14 flex items-center gap-4"
        style={{
          background: 'rgba(4,8,15,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid #E6EBF2',
        }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
            style={{ background: 'linear-gradient(135deg, #4F8AFF 0%, #8B6FFF 100%)' }}
          >
            BC
          </div>
          <span className="text-base font-semibold tracking-tight" style={{ color: '#0F172A' }}>BCDesk</span>
        </Link>

        <div className="flex items-center gap-2 ml-1">
          <span className="text-sm font-medium" style={{ color: '#64748B' }}>/</span>
          <span className="text-sm font-medium" style={{ color: '#1E293B' }}>API Reference</span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(79,138,255,0.15)', color: '#4F8AFF' }}
          >
            v1.0
          </span>
        </div>

        <div className="flex-1" />

        <Link
          href="/admin/settings"
          className="text-xs font-medium transition-colors flex items-center gap-1"
          style={{ color: '#4F8AFF' }}
        >
          Clave API en configuración →
        </Link>
      </div>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar de navegación */}
        <aside
          className="w-56 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pl-6 pr-4"
          style={{ borderRight: '1px solid #E6EBF2' }}
        >
          <nav className="space-y-1">
            {SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block px-3 py-2 rounded-lg text-sm transition-colors text-[#64748B] hover:text-[#1E293B]"
              >
                {s.label}
              </a>
            ))}
          </nav>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid #E6EBF2' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#CBD5E1' }}>
              Recursos
            </p>
            <Link
              href="/admin/settings/integrations"
              className="block text-xs py-1.5 transition-colors text-[#64748B] hover:text-[#64748B]"
            >
              Configurar webhooks
            </Link>
            <Link
              href="/admin/settings"
              className="block text-xs py-1.5 transition-colors text-[#64748B] hover:text-[#64748B]"
            >
              Obtener clave API
            </Link>
          </div>
        </aside>

        {/* Contenido principal */}
        <main className="flex-1 min-w-0 px-8 py-10 space-y-16">
          <SectionAuth />
          <SectionTickets />
          <SectionClients />
          <SectionWebhooks />
        </main>
      </div>
    </div>
  )
}
