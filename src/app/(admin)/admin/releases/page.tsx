import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Package, Plus } from 'lucide-react'
import { revalidatePath } from 'next/cache'

const STATUS_COLOR: Record<string, string> = {
  planned: 'bg-[#E6EBF2] text-[#5B6B7C]',
  in_progress: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  deployed: 'bg-[#10B981]/20 text-[#10B981]',
  failed: 'bg-[#EF4444]/20 text-[#EF4444]',
  cancelled: 'bg-[#E6EBF2] text-[#5B6B7C]',
}
const TYPE_COLOR: Record<string, string> = {
  major: 'bg-[#EF4444]/20 text-[#EF4444]',
  minor: 'bg-[#1789FC]/20 text-[#1789FC]',
  patch: 'bg-[#10B981]/20 text-[#10B981]',
  hotfix: 'bg-[#F59E0B]/20 text-[#F59E0B]',
}

export default async function ReleasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin','agent'].includes(profile.role)) redirect('/dashboard')

  const { data: releases } = await supabase
    .from('releases')
    .select('*, release_changes(count)')
    .order('planned_date', { ascending: false })

  const list = releases ?? []

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('releases').insert({
      name: formData.get('name') as string,
      version: formData.get('version') as string,
      description: formData.get('description') as string || null,
      release_type: formData.get('release_type') as string || 'minor',
      environment: formData.get('environment') as string || 'production',
      planned_date: formData.get('planned_date') as string || null,
      rollback_plan: formData.get('rollback_plan') as string || null,
      created_by: user?.id,
    })
    revalidatePath('/admin/releases')
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Gestión de releases</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">ITIL Release Management — paquetes de cambios para despliegue</p>
      </div>

      {/* Create */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Nuevo release</h2>
        <form action={handleCreate} className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Nombre *</label>
            <input name="name" required placeholder="ej: Sprint 24 Release"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Versión *</label>
            <input name="version" required placeholder="ej: 2.4.0"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Tipo</label>
            <select name="release_type" defaultValue="minor"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="major">Major</option>
              <option value="minor">Minor</option>
              <option value="patch">Patch</option>
              <option value="hotfix">Hotfix</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Ambiente</label>
            <select name="environment" defaultValue="production"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Fecha planificada</label>
            <input name="planned_date" type="datetime-local"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Descripción</label>
            <input name="description" placeholder="Resumen del release"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-3 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Crear release
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {list.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Release', 'Versión', 'Tipo', 'Ambiente', 'Estado', 'Cambios', 'Fecha', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r: any) => (
                <tr key={r.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3 font-medium text-[#0B2545]">{r.name}</td>
                  <td className="px-4 py-3 text-xs font-mono text-[#5B6B7C]">v{r.version}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[r.release_type]}`}>
                      {r.release_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{r.environment}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{r.release_changes?.[0]?.count ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">
                    {r.planned_date ? new Date(r.planned_date).toLocaleDateString('es-CO') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/releases/${r.id}`}
                      className="px-3 py-1 rounded-lg bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#0B2545] text-xs transition-colors">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Package size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Sin releases registrados.</p>
        </div>
      )}
    </div>
  )
}
