import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import type { Role } from '@/lib/supabase/types'

interface TeamMember {
  id: string
  full_name: string
  email: string
  role: Role
  is_active: boolean
  last_login_at: string | null
}

const roleConfig: Record<Role, { label: string; color: string; bg: string }> = {
  admin:  { label: 'Admin',   color: '#4F8AFF', bg: 'rgba(79,138,255,0.12)' },
  agent:  { label: 'Agente',  color: '#00D4FF', bg: 'rgba(0,212,255,0.12)' },
  client: { label: 'Cliente', color: '#10D98A', bg: 'rgba(16,217,138,0.12)' },
}

const gradients: string[] = [
  'from-[#4F8AFF] to-[#8B6FFF]',
  'from-[#8B6FFF] to-[#FF4D6A]',
  'from-[#10D98A] to-[#4F8AFF]',
  'from-[#FFB547] to-[#FF4D6A]',
  'from-[#00D4FF] to-[#4F8AFF]',
  'from-[#FF4D6A] to-[#FFB547]',
]

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function isOnline(lastLogin: string | null): boolean {
  if (!lastLogin) return false
  return Date.now() - new Date(lastLogin).getTime() < 24 * 60 * 60 * 1000
}

export default async function ClientTeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/client/dashboard')

  const { data: members } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, last_login_at')
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)
    .order('full_name')

  const list: TeamMember[] = members ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#F0F4FF]">Equipo</h1>
        <p className="text-sm text-[#8B9BB4] mt-0.5">{list.length} miembro{list.length !== 1 ? 's' : ''} activo{list.length !== 1 ? 's' : ''}</p>
      </div>

      {list.length === 0 ? (
        <div
          className="rounded-2xl p-16 flex flex-col items-center justify-center text-center"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Users size={44} className="text-[#8B9BB4] mb-4" />
          <p className="text-[#F0F4FF] font-medium">No hay miembros en el equipo</p>
          <p className="text-sm text-[#8B9BB4] mt-1">Los integrantes de tu organización aparecerán aquí</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((member, idx) => {
            const role = roleConfig[member.role] ?? roleConfig.client
            const online = isOnline(member.last_login_at)
            const grad = gradients[idx % gradients.length]

            return (
              <div
                key={member.id}
                className="rounded-2xl p-5 flex flex-col items-center text-center gap-3"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="relative">
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-lg select-none`}>
                    {initials(member.full_name)}
                  </div>
                  {online && (
                    <span
                      className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2"
                      style={{ background: '#10D98A', borderColor: '#04080F' }}
                    />
                  )}
                </div>

                <div className="w-full min-w-0">
                  <p className="text-sm font-semibold text-[#F0F4FF] truncate">{member.full_name}</p>
                  <p className="text-xs text-[#8B9BB4] truncate mt-0.5">{member.email}</p>
                </div>

                <span
                  className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                  style={{ color: role.color, background: role.bg }}
                >
                  {role.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
