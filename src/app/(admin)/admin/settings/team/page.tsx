import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createInvitation, toggleUserActive, changeUserRole, cancelInvitation } from '@/features/admin/services/admin.service'
import { CopyButton } from '@/shared/components/copy-button'
import { AutoSubmitSelect } from '@/shared/components/auto-submit-select'
import { UserPlus, Trash2 } from 'lucide-react'

export default async function AdminTeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const { data: team } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['admin', 'agent'])
    .order('role', { ascending: true })

  const { data: pendingInvites } = await supabase
    .from('invitations')
    .select('*')
    .in('role', ['admin', 'agent'])
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  async function handleInvite(formData: FormData) {
    'use server'
    const email = formData.get('email') as string
    const role = formData.get('role') as 'agent' | 'admin'
    if (email) await createInvitation(email, null, role)
    redirect('/admin/settings/team')
  }

  async function handleToggle(formData: FormData) {
    'use server'
    const uid = formData.get('user_id') as string
    const current = formData.get('is_active') === 'true'
    await toggleUserActive(uid, !current)
    redirect('/admin/settings/team')
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Equipo</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">
          {team?.length ?? 0} miembros · {pendingInvites?.length ?? 0} invitaciones pendientes
        </p>
      </div>

      {/* Miembros */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#334155]">
          <h2 className="text-sm font-semibold text-[#F1F5F9]">Miembros</h2>
        </div>
        {(team ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm text-[#64748B] text-center">Sin miembros registrados.</p>
        )}
        {(team ?? []).map(member => (
          <div key={member.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#334155]/50 last:border-0">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${member.is_active ? 'bg-[#334155]' : 'bg-[#1E293B] border border-[#334155] opacity-50'}`}>
              {member.full_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${member.is_active ? 'text-[#F1F5F9]' : 'text-[#64748B] line-through'}`}>
                {member.full_name}
                {member.id === user.id && <span className="ml-2 text-[10px] text-[#64748B]">(tú)</span>}
              </p>
              <p className="text-xs text-[#64748B]">{member.email}</p>
            </div>

            {/* Cambiar rol — mejora 3 */}
            {member.id !== user.id ? (
              <form action={changeUserRole}>
                <input type="hidden" name="user_id" value={member.id} />
                <AutoSubmitSelect
                  name="role"
                  defaultValue={member.role}
                  options={[
                    { value: 'agent', label: 'Agente' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                  className="text-xs px-2 py-1 rounded-lg bg-[#0F172A] border border-[#334155] text-[#94A3B8] focus:outline-none focus:border-[#3B82F6] transition-colors"
                />
              </form>
            ) : (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                member.role === 'admin' ? 'bg-[#3B82F6]/20 text-[#3B82F6]' : 'bg-[#06B6D4]/20 text-[#06B6D4]'
              }`}>
                {member.role === 'admin' ? 'Admin' : 'Agente'}
              </span>
            )}

            {/* Activar / Desactivar */}
            {member.id !== user.id && (
              <form action={handleToggle}>
                <input type="hidden" name="user_id" value={member.id} />
                <input type="hidden" name="is_active" value={String(member.is_active)} />
                <button
                  type="submit"
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors border shrink-0 ${
                    member.is_active
                      ? 'border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10'
                      : 'border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/10'
                  }`}
                >
                  {member.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {/* Invitaciones pendientes */}
      {(pendingInvites ?? []).length > 0 && (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#334155]">
            <h2 className="text-sm font-semibold text-[#F1F5F9]">Invitaciones pendientes</h2>
          </div>
          {(pendingInvites ?? []).map(inv => (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#334155]/50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#F1F5F9]">{inv.email}</p>
                <p className="text-xs text-[#64748B]">
                  Vence {new Date(inv.expires_at).toLocaleDateString('es-CO')}
                </p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                inv.role === 'admin' ? 'bg-[#3B82F6]/20 text-[#3B82F6]' : 'bg-[#06B6D4]/20 text-[#06B6D4]'
              }`}>
                {inv.role === 'admin' ? 'Admin' : 'Agente'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#F59E0B] shrink-0">
                Pendiente
              </span>

              {/* Copiar link — mejora 1 */}
              <CopyButton text={`${appUrl}/invite/${inv.token}`} />

              {/* Cancelar invitación — mejora 2 */}
              <form action={cancelInvitation}>
                <input type="hidden" name="invitation_id" value={inv.id} />
                <button
                  type="submit"
                  title="Cancelar invitación"
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {/* Formulario de invitación */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4 flex items-center gap-2">
          <UserPlus size={16} className="text-[#3B82F6]" /> Invitar nuevo miembro
        </h2>
        <form action={handleInvite} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Email *</label>
              <input
                name="email"
                type="email"
                required
                placeholder="agente@bcfabric.co"
                className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors placeholder-[#64748B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">Rol</label>
              <select
                name="role"
                defaultValue="agent"
                className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-[#334155] text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
              >
                <option value="agent">Agente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors"
          >
            <UserPlus size={14} /> Enviar invitación
          </button>
        </form>
      </div>
    </div>
  )
}
