import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PrintButton } from './print-button'
import { LogoMark } from '@/shared/components/logo'
import { visitTypeMeta, visitStatusLabel } from './labels'

const fdate = (v: string | null) => (v ? format(new Date(v), "dd 'de' MMMM yyyy, HH:mm", { locale: es }) : '—')

export async function VisitPdfContent({ basePath, id }: { basePath: string; id: string }) {
  const supabase = await createClient()
  const { data: visit } = await supabase.from('technical_visits')
    .select('*, organizations(name, address, phone), technician:profiles!technician_id(full_name, email)')
    .eq('id', id).single()
  if (!visit) notFound()

  const { data: attachments } = await supabase.from('technical_visit_attachments')
    .select('*').eq('visit_id', id).order('created_at')

  const v = visit as Record<string, unknown>
  const org = v.organizations as { name: string; address: string | null; phone: string | null } | null
  const tech = v.technician as { full_name: string; email: string } | null
  const tm = visitTypeMeta(v.visit_type as string)
  const atts = attachments ?? []

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'pre-wrap' }}>{value || '—'}</div>
    </div>
  )

  return (
    <>
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print { .no-print { display: none !important; } body { background: #fff !important; } }
      `}</style>

      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 50 }}>
        <Link href={`${basePath}/visits/${id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#e2e8f0', color: '#475569', fontSize: 14, fontWeight: 500 }}>
          <ArrowLeft size={14} /> Volver
        </Link>
        <PrintButton />
      </div>

      <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', justifyContent: 'center', padding: '40px 0' }} className="print:bg-white print:p-0 print:block">
        <div style={{ width: 794, background: '#fff', padding: 48, boxShadow: '0 1px 8px rgba(0,0,0,.08)' }} className="print:shadow-none">

          {/* Encabezado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #3b82f6', paddingBottom: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LogoMark size={28} />
                <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 16 }}>HexDesk</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Reporte de visita técnica · Fernando Bolívar Buitrago</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{v.visit_number as string}</div>
              <div style={{ fontSize: 12, color: tm?.color, fontWeight: 600 }}>{tm?.emoji} {tm?.label}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{visitStatusLabel(v.status as string)}</div>
            </div>
          </div>

          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 18 }}>{v.title as string}</h1>

          {/* Cliente y técnico */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Cliente</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{org?.name ?? '—'}</div>
              {org?.address && <div style={{ fontSize: 11, color: '#64748b' }}>{org.address}</div>}
              {org?.phone && <div style={{ fontSize: 11, color: '#64748b' }}>{org.phone}</div>}
            </div>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Técnico</div>
              <div style={{ fontSize: 14, color: '#0f172a' }}>{tech?.full_name ?? '—'}</div>
              {tech?.email && <div style={{ fontSize: 11, color: '#64748b' }}>{tech.email}</div>}
            </div>
          </div>

          {/* Datos de la visita */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 18, background: '#f8fafc', padding: 14, borderRadius: 8 }}>
            <Field label="Sitio" value={(v.location as string) || '—'} />
            <Field label="Contacto en sitio" value={(v.contact_name as string) || '—'} />
            <Field label="Programada" value={fdate(v.scheduled_at as string)} />
            <Field label="Llegada" value={fdate(v.started_at as string)} />
            <Field label="Salida" value={fdate(v.ended_at as string)} />
            <Field label="Materiales / repuestos" value={(v.materials as string) || '—'} />
          </div>

          <Field label="🛠️ Trabajo realizado" value={(v.work_performed as string) || '—'} />
          <Field label="🔍 Hallazgos" value={(v.findings as string) || '—'} />
          <Field label="💡 Recomendaciones" value={(v.recommendations as string) || '—'} />

          {/* Evidencia */}
          {atts.length > 0 && (
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 8 }}>📸 Evidencia fotográfica</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {atts.map((a: Record<string, unknown>) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={a.id as string} src={a.file_url as string} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} />
                ))}
              </div>
            </div>
          )}

          {/* Firma */}
          <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6, fontSize: 12, color: '#0f172a' }}>{tech?.full_name ?? ''}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Técnico responsable</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6, fontSize: 12, color: '#0f172a' }}>{(v.client_signoff as string) || ''}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Conformidad del cliente</div>
            </div>
          </div>

          <div style={{ marginTop: 28, fontSize: 9, color: '#cbd5e1', textAlign: 'center' }}>
            Documento generado por HexDesk · {v.visit_number as string} · {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })} · BC Fabric SAS
          </div>
        </div>
      </div>
    </>
  )
}
