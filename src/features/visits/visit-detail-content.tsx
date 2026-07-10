import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2, Save, Play, CheckCircle2, XCircle, MapPin, User, Building2, Clock, FileDown, Mail, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { updateVisit, setVisitStatus, deleteVisit, deleteVisitAttachment, sendVisitReport } from './visit.service'
import { VisitEvidenceUpload } from './visit-evidence'
import { VISIT_TYPES, VISIT_STATUS, visitTypeMeta, visitStatusColor, visitStatusLabel } from './labels'

const input = 'w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]'
const lbl = 'block text-xs text-[#5B6B7C] mb-1'
const dt = (v: string | null) => (v ? String(v).slice(0, 16) : '')

export async function VisitDetailContent({ basePath, id, saved, sent }: { basePath: string; id: string; saved?: boolean; sent?: string }) {
  const supabase = await createClient()

  const { data: visit } = await supabase.from('technical_visits')
    .select('*, organizations(name), technician:profiles!technician_id(full_name)')
    .eq('id', id).single()
  if (!visit) notFound()

  const [{ data: attachments }, { data: orgs }, { data: agents }] = await Promise.all([
    supabase.from('technical_visit_attachments').select('*').eq('visit_id', id).order('created_at'),
    supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'agent']).eq('is_active', true).order('full_name'),
  ])

  const v = visit as Record<string, unknown>
  const org = v.organizations as { name: string } | null
  const tm = visitTypeMeta(v.visit_type as string)

  // El bucket es privado: se firma la URL de cada evidencia para poder visualizarla.
  const atts = await Promise.all((attachments ?? []).map(async (a: Record<string, unknown>) => {
    const fileUrl = a.file_url as string
    const path = fileUrl?.split('/ticket-attachments/')[1]
    if (!path) return { ...a, signed_url: fileUrl }
    const { data } = await supabase.storage.from('ticket-attachments').createSignedUrl(decodeURIComponent(path), 3600)
    return { ...a, signed_url: data?.signedUrl ?? fileUrl }
  }))

  const StatusBtn = ({ status, label, icon: Icon }: { status: string; label: string; icon: React.ElementType }) => (
    <form action={setVisitStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="base_path" value={basePath} />
      <button type="submit" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-transform hover:scale-105"
        style={{ background: `${visitStatusColor(status)}20`, color: visitStatusColor(status) }}>
        <Icon size={13} /> {label}
      </button>
    </form>
  )

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={`${basePath}/visits`} className="inline-flex items-center gap-2 text-sm text-[#5B6B7C] hover:text-[#0B2545]">
          <ArrowLeft size={14} /> Volver a visitas
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`${basePath}/visits/${id}/pdf`} target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#5B6B7C] hover:text-[#0B2545] transition-colors">
            <FileDown size={13} /> PDF
          </Link>
          <form action={sendVisitReport}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="base_path" value={basePath} />
            <button type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1789FC] hover:bg-[#0B72D6] text-white transition-colors">
              <Mail size={13} /> {v.report_sent_at ? 'Reenviar acta al cliente' : 'Enviar acta al cliente'}
            </button>
          </form>
          {v.status === 'scheduled' && <StatusBtn status="in_progress" label="Iniciar (en sitio)" icon={Play} />}
          {v.status === 'in_progress' && <StatusBtn status="completed" label="Completar" icon={CheckCircle2} />}
          {v.status !== 'cancelled' && v.status !== 'completed' && <StatusBtn status="cancelled" label="Cancelar" icon={XCircle} />}
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-sm font-medium">
          <CheckCircle2 size={16} /> Registro guardado correctamente
        </div>
      )}
      {sent === '1' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-sm font-medium">
          <Mail size={16} /> Acta enviada al cliente por correo (con el PDF adjunto)
        </div>
      )}
      {sent === 'noclient' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-sm font-medium">
          <AlertTriangle size={16} /> Esta organización no tiene un usuario cliente con correo activo. Crea el acceso del cliente para poder enviarle el acta.
        </div>
      )}
      {sent === 'error' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm font-medium">
          <AlertTriangle size={16} /> No se pudo enviar el acta. Revisa la configuración de correo e inténtalo de nuevo.
        </div>
      )}

      {/* Cabecera */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-[#5B6B7C]">{v.visit_number as string}</span>
              <span className="text-xs font-medium" style={{ color: tm?.color }}>{tm?.emoji} {tm?.label}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: `${visitStatusColor(v.status as string)}20`, color: visitStatusColor(v.status as string) }}>
                {visitStatusLabel(v.status as string)}
              </span>
              {v.report_sent_at ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#10B981]/15 text-[#10B981] flex items-center gap-1">
                  <Mail size={10} /> Acta enviada {format(new Date(v.report_sent_at as string), "dd MMM yyyy", { locale: es })}
                </span>
              ) : null}
            </div>
            <h1 className="text-lg font-semibold text-[#0B2545]">{v.title as string}</h1>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
          <div><p className="text-[11px] text-[#94A3B8] flex items-center gap-1"><Building2 size={11} /> Cliente</p><p className="text-[#0B2545]">{org?.name ?? '—'}</p></div>
          <div><p className="text-[11px] text-[#94A3B8] flex items-center gap-1"><User size={11} /> Contacto</p><p className="text-[#0B2545]">{(v.contact_name as string) || '—'}</p></div>
          <div><p className="text-[11px] text-[#94A3B8] flex items-center gap-1"><MapPin size={11} /> Sitio</p><p className="text-[#0B2545]">{(v.location as string) || '—'}</p></div>
          <div><p className="text-[11px] text-[#94A3B8] flex items-center gap-1"><Clock size={11} /> Programada</p><p className="text-[#0B2545]">{v.scheduled_at ? format(new Date(v.scheduled_at as string), 'dd MMM yyyy HH:mm', { locale: es }) : '—'}</p></div>
        </div>
      </div>

      {/* Evidencia (fotos) */}
      <div className="bg-white border border-[#E6EBF2] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#0B2545]">📸 Evidencia fotográfica ({atts.length})</h2>
          <VisitEvidenceUpload visitId={id} />
        </div>
        {atts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 md:grid-cols-4 gap-3">
            {atts.map((a: Record<string, unknown>) => (
              <div key={a.id as string} className="relative group rounded-lg overflow-hidden border border-[#E6EBF2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <a href={a.signed_url as string} target="_blank" rel="noopener noreferrer">
                  <img src={a.signed_url as string} alt={a.file_name as string} className="w-full h-28 object-cover" />
                </a>
                <form action={deleteVisitAttachment} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <input type="hidden" name="attachment_id" value={a.id as string} />
                  <input type="hidden" name="visit_id" value={id} />
                  <input type="hidden" name="base_path" value={basePath} />
                  <button type="submit" className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}>
                    <Trash2 size={12} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#94A3B8]">Aún sin fotos. Usa "Agregar fotos" para dejar evidencia del sitio.</p>
        )}
      </div>

      {/* Formulario de evidencia / edición */}
      <form action={updateVisit} className="bg-white border border-[#E6EBF2] rounded-xl p-5 space-y-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="base_path" value={basePath} />
        <h2 className="text-sm font-semibold text-[#0B2545]">Registro de la visita</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="col-span-2"><label className={lbl}>Título / motivo *</label><input name="title" required defaultValue={v.title as string} className={input} /></div>
          <div><label className={lbl}>Tipo</label>
            <select name="visit_type" defaultValue={v.visit_type as string} className={input}>
              {VISIT_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Cliente *</label>
            <select name="organization_id" required defaultValue={v.organization_id as string} className={input}>
              {(orgs ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Técnico</label>
            <select name="technician_id" defaultValue={(v.technician_id as string) ?? ''} className={input}>
              <option value="">—</option>
              {(agents ?? []).map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Sitio / dirección</label><input name="location" defaultValue={(v.location as string) ?? ''} className={input} /></div>
          <div><label className={lbl}>Contacto en sitio</label><input name="contact_name" defaultValue={(v.contact_name as string) ?? ''} className={input} /></div>
          <div><label className={lbl}>Programada</label><input name="scheduled_at" type="datetime-local" defaultValue={dt(v.scheduled_at as string)} className={input} /></div>
          <div><label className={lbl}>Inicio (llegada)</label><input name="started_at" type="datetime-local" defaultValue={dt(v.started_at as string)} className={input} /></div>
          <div><label className={lbl}>Fin (salida)</label><input name="ended_at" type="datetime-local" defaultValue={dt(v.ended_at as string)} className={input} /></div>
        </div>

        <div><label className={lbl}>🛠️ Trabajo realizado</label><textarea name="work_performed" rows={3} defaultValue={(v.work_performed as string) ?? ''} placeholder="Describe qué se hizo en la visita…" className={input} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={lbl}>🔍 Hallazgos</label><textarea name="findings" rows={3} defaultValue={(v.findings as string) ?? ''} placeholder="Qué se encontró / diagnóstico" className={input} /></div>
          <div><label className={lbl}>💡 Recomendaciones</label><textarea name="recommendations" rows={3} defaultValue={(v.recommendations as string) ?? ''} placeholder="Próximos pasos / sugerencias" className={input} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={lbl}>📦 Materiales / repuestos usados</label><input name="materials" defaultValue={(v.materials as string) ?? ''} className={input} /></div>
          <div><label className={lbl}>✍️ Firma / conformidad del cliente</label><input name="client_signoff" defaultValue={(v.client_signoff as string) ?? ''} placeholder="Nombre de quien aprueba" className={input} /></div>
        </div>

        <div className="flex justify-between items-center">
          <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
            <Save size={14} /> Guardar registro
          </button>
        </div>
      </form>

      {/* Eliminar */}
      <form action={deleteVisit} className="flex justify-end">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="base_path" value={basePath} />
        <button type="submit" className="flex items-center gap-1.5 text-xs text-[#5B6B7C] hover:text-[#EF4444] transition-colors">
          <Trash2 size={13} /> Eliminar visita
        </button>
      </form>
    </div>
  )
}
