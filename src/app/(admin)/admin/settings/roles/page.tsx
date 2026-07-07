import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Shield, Plus, Trash2 } from 'lucide-react'

const ALL_PERMISSIONS = [
  { key: 'tickets.view', label: 'Ver tickets' },
  { key: 'tickets.create', label: 'Crear tickets' },
  { key: 'tickets.edit', label: 'Editar tickets' },
  { key: 'tickets.assign', label: 'Asignar tickets' },
  { key: 'tickets.close', label: 'Cerrar tickets' },
  { key: 'tickets.delete', label: 'Eliminar tickets' },
  { key: 'clients.view', label: 'Ver clientes' },
  { key: 'clients.manage', label: 'Gestionar clientes' },
  { key: 'invoices.view', label: 'Ver facturas' },
  { key: 'invoices.create', label: 'Crear facturas' },
  { key: 'projects.view', label: 'Ver proyectos' },
  { key: 'projects.manage', label: 'Gestionar proyectos' },
  { key: 'reports.view', label: 'Ver reportes' },
  { key: 'knowledge.view', label: 'Ver KB' },
  { key: 'knowledge.manage', label: 'Gestionar KB' },
  { key: 'assets.view', label: 'Ver activos CMDB' },
  { key: 'assets.manage', label: 'Gestionar activos' },
  { key: 'changes.view', label: 'Ver cambios RFC' },
  { key: 'changes.approve', label: 'Aprobar cambios' },
  { key: 'settings.view', label: 'Ver configuración' },
  { key: 'settings.manage', label: 'Gestionar configuración' },
  { key: 'users.manage', label: 'Gestionar usuarios' },
]

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: roles } = await supabase.from('custom_roles').select('*').order('created_at')
  const list = roles ?? []

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const perms: Record<string, boolean> = {}
    for (const p of ALL_PERMISSIONS) {
      perms[p.key] = formData.get(`perm_${p.key}`) === 'on'
    }
    await supabase.from('custom_roles').insert({
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      permissions: perms,
    })
    revalidatePath('/admin/settings/roles')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('custom_roles').delete().eq('id', id)
    revalidatePath('/admin/settings/roles')
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Roles personalizados</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Define permisos granulares más allá de admin/agente/cliente</p>
      </div>

      {/* Create */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Nuevo rol</h2>
        <form action={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Nombre del rol *</label>
              <input name="name" required placeholder="ej: Técnico de campo"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
            </div>
            <div>
              <label className="block text-xs text-[#5B6B7C] mb-1">Descripción</label>
              <input name="description" placeholder="¿Qué puede hacer este rol?"
                className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-2">Permisos</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ALL_PERMISSIONS.map(p => (
                <label key={p.key} className="flex items-center gap-2 text-xs text-[#5B6B7C] cursor-pointer px-2 py-1.5 rounded hover:bg-[#EEF2F7]">
                  <input type="checkbox" name={`perm_${p.key}`} className="rounded" />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Crear rol
            </button>
          </div>
        </form>
      </div>

      {/* Roles list */}
      {list.length > 0 ? (
        <div className="space-y-3">
          {list.map((role: any) => {
            const perms = role.permissions as Record<string, boolean>
            const enabledCount = Object.values(perms).filter(Boolean).length
            return (
              <div key={role.id} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[#0B2545]">{role.name}</h3>
                    {role.description && <p className="text-xs text-[#5B6B7C] mt-0.5">{role.description}</p>}
                    <p className="text-xs text-[#CBD5E1] mt-1">{enabledCount} permisos activos</p>
                  </div>
                  <form action={handleDelete.bind(null, role.id)}>
                    <button type="submit" className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {ALL_PERMISSIONS.filter(p => perms[p.key]).map(p => (
                    <span key={p.key} className="px-2 py-0.5 rounded-full text-[10px] bg-[#1789FC]/20 text-[#1789FC]">
                      {p.label}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Shield size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Sin roles personalizados. Los roles base (admin/agente/cliente) siguen activos.</p>
        </div>
      )}
    </div>
  )
}
