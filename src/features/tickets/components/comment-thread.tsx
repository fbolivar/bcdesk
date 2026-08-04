'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Lock, Paperclip, Pencil, Trash2, Check, X, Loader2, Cog } from 'lucide-react'
import { updateComment, deleteComment } from '@/features/tickets/services/agent.service'

export type ThreadAttachment = { id: string; file_name: string; url: string; mime_type: string | null }
export type ThreadComment = {
  id: string
  content: string
  is_internal: boolean
  is_automated: boolean
  created_at: string
  edited_at: string | null
  authorId: string | null
  authorName: string | null
  authorRole: string | null
  attachments: ThreadAttachment[]
}

function roleChip(role: string | null): { label: string; color: string; bg: string } {
  if (role === 'client') return { label: 'Cliente', color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)' }
  if (role === 'admin' || role === 'agent') return { label: 'Soporte', color: '#0E9E86', bg: 'rgba(0,212,170,0.12)' }
  return { label: 'Sistema', color: '#5B6B7C', bg: '#E6EBF2' }
}

function initials(name: string | null) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function Attachments({ atts }: { atts: ThreadAttachment[] }) {
  if (!atts.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {atts.map(a => {
        const isImg = (a.mime_type ?? '').startsWith('image/')
        return isImg ? (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" title={a.file_name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.url} alt={a.file_name} className="h-24 w-24 object-cover rounded-lg border border-[#E6EBF2]" />
          </a>
        ) : (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#0E9E86] hover:underline border border-[#E6EBF2] rounded-lg px-2.5 py-1.5 bg-[#F7F9FC]">
            <Paperclip size={12} /> <span className="max-w-[200px] truncate">{a.file_name}</span>
          </a>
        )
      })}
    </div>
  )
}

function CommentCard({ c, canEdit }: { c: ThreadComment; canEdit: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(c.content)
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()

  const chip = roleChip(c.authorRole)
  const created = new Date(c.created_at)
  const absolute = format(created, "d 'de' MMMM yyyy, HH:mm", { locale: es })

  function save() {
    setError(null)
    startSaving(async () => {
      const res = await updateComment(c.id, value)
      if (res?.error) { setError(res.error); return }
      setEditing(false)
      router.refresh()
    })
  }

  function remove() {
    if (!confirm('¿Eliminar este mensaje? Esta acción es permanente.')) return
    setError(null)
    startDeleting(async () => {
      const res = await deleteComment(c.id)
      if (res?.error) { setError(res.error); return }
      router.refresh()
    })
  }

  // Registro automático del sistema: estilo discreto, no editable.
  if (c.is_automated) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#5B6B7C]"
        style={{ background: '#F7F9FC', border: '1px dashed #E6EBF2' }}>
        <Cog size={13} className="text-[#94A3B8] shrink-0" />
        <span className="flex-1 min-w-0 whitespace-pre-wrap break-words">{c.content}</span>
        <span className="shrink-0 text-[10px] text-[#94A3B8]" title={absolute}>
          {formatDistanceToNow(created, { locale: es, addSuffix: true })}
        </span>
      </div>
    )
  }

  const cardStyle = c.is_internal
    ? 'bg-[#F59E0B]/5 border-[#F59E0B]/25'
    : c.authorRole === 'client'
      ? 'bg-white border-[#E6EBF2] border-l-[3px] border-l-[#8B5CF6]'
      : 'bg-white border-[#E6EBF2] border-l-[3px] border-l-[#00D4AA]'

  return (
    <div className={`group p-4 rounded-xl border ${cardStyle}`}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
          style={{ background: c.authorRole === 'client' ? 'linear-gradient(135deg,#8B5CF6,#6D28D9)' : 'linear-gradient(135deg,#00D4AA,#0E9E86)' }}>
          {initials(c.authorName)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-[#0B2545] truncate">{c.authorName ?? 'Usuario'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ color: chip.color, background: chip.bg }}>{chip.label}</span>
            {c.is_internal && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded-full font-medium">
                <Lock size={9} /> Nota interna
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#94A3B8]" title={absolute}>
            {formatDistanceToNow(created, { locale: es, addSuffix: true })}
            {c.edited_at && <span className="italic"> · editado</span>}
          </span>
        </div>

        {canEdit && !editing && (
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => { setValue(c.content); setEditing(true); setError(null) }} title="Editar"
              className="p-1.5 rounded-lg text-[#5B6B7C] hover:text-[#0E9E86] hover:bg-[#00D4AA]/10">
              <Pencil size={13} />
            </button>
            <button onClick={remove} disabled={deleting} title="Eliminar"
              className="p-1.5 rounded-lg text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 disabled:opacity-50">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea value={value} onChange={e => setValue(e.target.value)} rows={Math.min(12, Math.max(3, value.split('\n').length + 1))}
            className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] text-sm leading-relaxed focus:outline-none focus:border-[#00D4AA] resize-y" />
          <p className="text-[11px] text-[#94A3B8]">Consejo: usa una línea por punto (Enter) para que se lea ordenado.</p>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving || !value.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-xs font-medium disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar
            </button>
            <button onClick={() => { setEditing(false); setError(null) }} disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E6EBF2] text-[#5B6B7C] text-xs font-medium">
              <X size={13} /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#0B2545] leading-relaxed whitespace-pre-wrap break-words">{c.content}</p>
      )}

      {error && <p className="text-xs text-[#EF4444] mt-2">{error}</p>}

      {!editing && <Attachments atts={c.attachments} />}
    </div>
  )
}

export function CommentThread({ comments, currentUserId, currentUserRole }: {
  comments: ThreadComment[]
  currentUserId: string
  currentUserRole: string
}) {
  if (comments.length === 0) {
    return <p className="text-sm text-[#5B6B7C] py-4 text-center bg-white border border-[#E6EBF2] rounded-xl">Sin mensajes aún.</p>
  }
  return (
    <div className="space-y-4">
      {comments.map(c => {
        const canEdit = !c.is_automated && (currentUserRole === 'admin' || c.authorId === currentUserId)
        return <CommentCard key={c.id} c={c} canEdit={canEdit} />
      })}
    </div>
  )
}
