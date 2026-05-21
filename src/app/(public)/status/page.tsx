import { createClient } from '@/lib/supabase/server'
import { CheckCircle, AlertCircle, AlertTriangle, Clock, Info, Wrench } from 'lucide-react'

const SERVICES = [
  'Portal Web',
  'API REST',
  'Base de datos',
  'Chat en vivo',
  'Email',
  'Dashboard',
]

const SEVERITY_LABEL: Record<string, string> = { p1: 'P1', p2: 'P2', p3: 'P3' }
const SEVERITY_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  p1: { bg: 'rgba(255,77,106,0.12)', text: '#FF4D6A', border: 'rgba(255,77,106,0.3)' },
  p2: { bg: 'rgba(255,181,71,0.12)', text: '#FFB547', border: 'rgba(255,181,71,0.3)' },
  p3: { bg: 'rgba(79,138,255,0.12)', text: '#4F8AFF', border: 'rgba(79,138,255,0.3)' },
}

const STATUS_COLORS = {
  operational: { dot: '#10D98A', text: '#10D98A', label: 'Operativo' },
  incident: { dot: '#FF4D6A', text: '#FF4D6A', label: 'Incidente' },
  maintenance: { dot: '#FFB547', text: '#FFB547', label: 'Mantenimiento' },
  degraded: { dot: '#FFB547', text: '#FFB547', label: 'Degradado' },
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  info: <Info size={15} style={{ color: '#4F8AFF' }} />,
  warning: <AlertTriangle size={15} style={{ color: '#FFB547' }} />,
  incident: <AlertCircle size={15} style={{ color: '#FF4D6A' }} />,
  maintenance: <Clock size={15} style={{ color: '#8B6FFF' }} />,
  resolved: <CheckCircle size={15} style={{ color: '#10D98A' }} />,
}

const TYPE_BORDER: Record<string, string> = {
  info: 'rgba(79,138,255,0.2)',
  warning: 'rgba(255,181,71,0.2)',
  incident: 'rgba(255,77,106,0.2)',
  maintenance: 'rgba(139,111,255,0.2)',
  resolved: 'rgba(16,217,138,0.15)',
}

function timeAgo(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (diff < 1) return 'hace menos de un minuto'
  if (diff === 1) return 'hace 1 minuto'
  if (diff < 60) return `hace ${diff} minutos`
  const hours = Math.floor(diff / 60)
  if (hours === 1) return 'hace 1 hora'
  if (hours < 24) return `hace ${hours} horas`
  return `hace ${Math.floor(hours / 24)} días`
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function StatusPage() {
  const supabase = await createClient()

  const [
    { data: incidents },
    { data: maintenances },
    { data: announcements },
  ] = await Promise.all([
    supabase
      .from('major_incidents')
      .select('id, title, description, severity, status, created_at, affected_services')
      .neq('status', 'resolved')
      .order('created_at', { ascending: false }),
    supabase
      .from('maintenance_windows')
      .select('id, title, description, start_at, end_at, affected_services, status')
      .eq('status', 'scheduled')
      .order('start_at', { ascending: true }),
    supabase
      .from('announcements')
      .select('id, title, content, announcement_type, status, affected_services, created_at, starts_at, ends_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const activeIncidents = incidents ?? []
  const scheduledMaintenances = maintenances ?? []
  const recentAnnouncements = announcements ?? []

  const hasActiveIncident = activeIncidents.length > 0
  const latestUpdate = recentAnnouncements[0]?.created_at ?? new Date().toISOString()

  function getServiceStatus(serviceName: string) {
    const incidentAffected = activeIncidents.some(i => {
      const svcs = Array.isArray(i.affected_services) ? i.affected_services : []
      return svcs.some((s: string) => s.toLowerCase().includes(serviceName.toLowerCase()))
    })
    if (incidentAffected) return STATUS_COLORS.incident

    const maintenanceAffected = scheduledMaintenances.some(m => {
      const svcs = typeof m.affected_services === 'string'
        ? m.affected_services.split(',').map((s: string) => s.trim())
        : Array.isArray(m.affected_services) ? m.affected_services : []
      return svcs.some((s: string) => s.toLowerCase().includes(serviceName.toLowerCase()))
    })
    if (maintenanceAffected) return STATUS_COLORS.maintenance

    return STATUS_COLORS.operational
  }

  const cardStyle = {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: '#F0F4FF' }}>Estado del sistema</h1>
        <p className="text-sm mt-1" style={{ color: '#8B9BB4' }}>
          Estado en tiempo real de los servicios de BCDesk
        </p>
      </div>

      {/* Global status banner */}
      <div
        className="flex items-center gap-4 px-5 py-4 rounded-xl"
        style={hasActiveIncident ? {
          background: 'rgba(255,77,106,0.08)',
          border: '1px solid rgba(255,77,106,0.25)',
          borderRadius: '12px',
        } : {
          background: 'rgba(16,217,138,0.08)',
          border: '1px solid rgba(16,217,138,0.2)',
          borderRadius: '12px',
        }}
      >
        {hasActiveIncident
          ? <AlertCircle size={22} style={{ color: '#FF4D6A', flexShrink: 0 }} />
          : <CheckCircle size={22} style={{ color: '#10D98A', flexShrink: 0 }} />
        }
        <div>
          <p className="font-semibold" style={{ color: '#F0F4FF' }}>
            {hasActiveIncident
              ? `${activeIncidents.length} incidente${activeIncidents.length > 1 ? 's' : ''} activo${activeIncidents.length > 1 ? 's' : ''}`
              : 'Todos los sistemas operativos'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#8B9BB4' }}>
            Actualizado {timeAgo(latestUpdate)}
          </p>
        </div>
      </div>

      {/* Services grid */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#8B9BB4', letterSpacing: '0.07em' }}>
          Servicios
        </h2>
        <div style={cardStyle}>
          {SERVICES.map((service, idx) => {
            const status = getServiceStatus(service)
            return (
              <div
                key={service}
                className="flex items-center justify-between px-4 py-3"
                style={{
                  borderBottom: idx < SERVICES.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined,
                }}
              >
                <span className="text-sm font-medium" style={{ color: '#F0F4FF' }}>{service}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: status.dot, boxShadow: `0 0 6px ${status.dot}` }}
                  />
                  <span className="text-xs font-medium" style={{ color: status.text }}>
                    {status.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active incidents */}
      {activeIncidents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#8B9BB4', letterSpacing: '0.07em' }}>
            Incidentes activos
          </h2>
          <div className="space-y-3">
            {activeIncidents.map(incident => {
              const sev = SEVERITY_COLOR[incident.severity] ?? SEVERITY_COLOR.p3
              return (
                <div key={incident.id} style={{ ...cardStyle, borderColor: sev.border }}>
                  <div className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={16} style={{ color: '#FF4D6A', flexShrink: 0, marginTop: 2 }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: sev.bg, color: sev.text }}
                          >
                            {SEVERITY_LABEL[incident.severity]}
                          </span>
                          <span className="text-[11px]" style={{ color: '#8B9BB4' }}>
                            {incident.status === 'open' ? 'Abierto' :
                             incident.status === 'investigating' ? 'Investigando' :
                             incident.status === 'identified' ? 'Identificado' :
                             incident.status === 'monitoring' ? 'Monitoreando' : incident.status}
                          </span>
                        </div>
                        <h3 className="font-medium text-sm" style={{ color: '#F0F4FF' }}>{incident.title}</h3>
                        {incident.description && (
                          <p className="text-sm mt-1" style={{ color: '#8B9BB4' }}>{incident.description}</p>
                        )}
                        <p className="text-xs mt-2" style={{ color: '#4A5568' }}>
                          {formatDate(incident.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Scheduled maintenances */}
      {scheduledMaintenances.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#8B9BB4', letterSpacing: '0.07em' }}>
            Mantenimientos programados
          </h2>
          <div className="space-y-3">
            {scheduledMaintenances.map(mw => (
              <div key={mw.id} style={{ ...cardStyle, borderColor: 'rgba(139,111,255,0.2)' }}>
                <div className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <Wrench size={16} style={{ color: '#8B6FFF', flexShrink: 0, marginTop: 2 }} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm" style={{ color: '#F0F4FF' }}>{mw.title}</h3>
                      {mw.description && (
                        <p className="text-sm mt-1" style={{ color: '#8B9BB4' }}>{mw.description}</p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-2">
                        <span className="text-xs" style={{ color: '#4A5568' }}>
                          Inicio: {formatDate(mw.start_at)}
                        </span>
                        {mw.end_at && (
                          <span className="text-xs" style={{ color: '#4A5568' }}>
                            Fin: {formatDate(mw.end_at)}
                          </span>
                        )}
                      </div>
                      {mw.affected_services && (
                        <p className="text-xs mt-1.5" style={{ color: '#8B9BB4' }}>
                          Servicios afectados: {typeof mw.affected_services === 'string' ? mw.affected_services : mw.affected_services.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent history */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#8B9BB4', letterSpacing: '0.07em' }}>
          Historial reciente
        </h2>
        {recentAnnouncements.length > 0 ? (
          <div className="space-y-2">
            {recentAnnouncements.map(ann => (
              <div
                key={ann.id}
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: `1px solid ${TYPE_BORDER[ann.announcement_type] ?? 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '10px',
                }}
              >
                <div className="px-4 py-3 flex items-start gap-3">
                  <span className="mt-0.5 shrink-0">{TYPE_ICON[ann.announcement_type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: '#F0F4FF' }}>{ann.title}</p>
                    {ann.content && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#8B9BB4' }}>{ann.content}</p>
                    )}
                  </div>
                  <span className="text-xs shrink-0 ml-2" style={{ color: '#4A5568' }}>
                    {timeAgo(ann.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{ ...cardStyle, textAlign: 'center' }}
            className="px-4 py-10"
          >
            <CheckCircle size={28} style={{ color: '#10D98A', margin: '0 auto 10px' }} />
            <p className="text-sm" style={{ color: '#8B9BB4' }}>Sin eventos recientes</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="text-xs" style={{ color: '#4A5568' }}>
          BCDesk · Actualizado {timeAgo(latestUpdate)}
        </p>
      </div>
    </div>
  )
}
