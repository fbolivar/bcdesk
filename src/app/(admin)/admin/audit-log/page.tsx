import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ScrollText, Download } from 'lucide-react'

const ACTION_COLOR: Record<string, string> = {
  create: 'text-[#10B981]',
  update: 'text-[#3B82F6]',
  delete: 'text-[#EF4444]',
  login: 'text-[#F59E0B]',
  logout: 'text-[#64748B]',
  assign: 'text-[#8B5CF6]',
  resolve: 'text-[#10B981]',
  escalate: 'text-[#F59E0B]',
}

export default async function AuditLogPage({ searchParams }: { searchParams: { page?: string; resource?: string; actor?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const page = parseInt(searchParams.page ?? '1')
  const pageSize = 50
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('audit_logs')
    .select('*, profiles(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (searchParams.resource) query = query.eq('resource_type', searchParams.resource)
  if (searchParams.actor) query = query.eq('actor_id', searchParams.actor)

  const { data: logs, count } = await query
  const list = logs ?? []
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  // Recent actors for filter
  const { data: actors } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['admin', 'agent'])
    .order('full_name')

  const resourceTypes = ['ticket', 'invoice', 'asset', 'change', 'user', 'organization', 'kb_article', 'release']

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1E293B]">Audit log</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{count ?? 0} eventos registrados — historial completo de acciones</p>
        </div>
        <a href="/api/export/audit-log"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#1E293B] text-xs transition-colors">
          <Download size={12} /> Exportar CSV
        </a>
      </div>

      {/* Filters */}
      <form method="GET" className="flex gap-3">
        <select name="resource" defaultValue={searchParams.resource ?? ''}
          className="px-3 py-1.5 bg-[#FFFFFF] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-xs focus:outline-none focus:border-[#3B82F6]">
          <option value="">Todos los recursos</option>
          {resourceTypes.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select name="actor" defaultValue={searchParams.actor ?? ''}
          className="px-3 py-1.5 bg-[#FFFFFF] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-xs focus:outline-none focus:border-[#3B82F6]">
          <option value="">Todos los usuarios</option>
          {(actors ?? []).map(a => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
        </select>
        <button type="submit"
          className="px-3 py-1.5 rounded-lg bg-[#3B82F6] text-white text-xs font-medium hover:bg-[#2563EB] transition-colors">
          Filtrar
        </button>
        <a href="/admin/audit-log" className="px-3 py-1.5 rounded-lg border border-[#E6EBF2] text-[#64748B] text-xs hover:bg-[#EEF2F7] transition-colors">
          Limpiar
        </a>
      </form>

      {list.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Fecha', 'Usuario', 'Acción', 'Recurso', 'ID', 'IP'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((log: any) => {
                const actor = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles
                const actionKey = log.action.split('.')[0]
                return (
                  <tr key={log.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                    <td className="px-4 py-2.5 text-xs text-[#64748B] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('es-CO')}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#64748B]">
                      {actor?.full_name || log.actor_email || '—'}
                    </td>
                    <td className={`px-4 py-2.5 text-xs font-mono font-semibold ${ACTION_COLOR[actionKey] ?? 'text-[#64748B]'}`}>
                      {log.action}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#64748B]">{log.resource_type}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-[#CBD5E1]">
                      {log.resource_id?.slice(0, 8) ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#CBD5E1]">{log.ip_address ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-[#E6EBF2] flex items-center justify-between">
              <span className="text-xs text-[#64748B]">Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <a href={`?page=${page - 1}${searchParams.resource ? `&resource=${searchParams.resource}` : ''}${searchParams.actor ? `&actor=${searchParams.actor}` : ''}`}
                    className="px-3 py-1 rounded text-xs border border-[#E6EBF2] text-[#64748B] hover:bg-[#EEF2F7] transition-colors">
                    ← Anterior
                  </a>
                )}
                {page < totalPages && (
                  <a href={`?page=${page + 1}${searchParams.resource ? `&resource=${searchParams.resource}` : ''}${searchParams.actor ? `&actor=${searchParams.actor}` : ''}`}
                    className="px-3 py-1 rounded text-xs border border-[#E6EBF2] text-[#64748B] hover:bg-[#EEF2F7] transition-colors">
                    Siguiente →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <ScrollText size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#64748B] text-sm">Sin eventos en el audit log aún.</p>
          <p className="text-xs text-[#CBD5E1] mt-1">Los eventos se registran automáticamente con el helper <code className="bg-[#F4F7FB] px-1 rounded">logAudit()</code></p>
        </div>
      )}
    </div>
  )
}
