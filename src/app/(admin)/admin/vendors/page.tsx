import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { Building2, Plus, Trash2, ExternalLink } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  hardware: 'bg-[#3B82F6]/20 text-[#3B82F6]',
  software: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
  cloud: 'bg-[#06B6D4]/20 text-[#06B6D4]',
  telecom: 'bg-[#10B981]/20 text-[#10B981]',
  consulting: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  other: 'bg-[#334155] text-[#64748B]',
}

export default async function VendorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: vendors } = await supabase
    .from('vendors')
    .select('*, vendor_contracts(count)')
    .eq('is_active', true)
    .order('name')

  const list = vendors ?? []

  async function handleCreate(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('vendors').insert({
      name: formData.get('name') as string,
      category: formData.get('category') as string || null,
      contact_name: formData.get('contact_name') as string || null,
      contact_email: formData.get('contact_email') as string || null,
      contact_phone: formData.get('contact_phone') as string || null,
      website: formData.get('website') as string || null,
    })
    revalidatePath('/admin/vendors')
  }

  async function handleDelete(id: string) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    await supabase.from('vendors').update({ is_active: false }).eq('id', id)
    revalidatePath('/admin/vendors')
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-[#F1F5F9]">Gestión de proveedores</h1>
        <p className="text-sm text-[#94A3B8] mt-0.5">Vendors IT, contratos y SLAs de terceros</p>
      </div>

      {/* Create */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F1F5F9] mb-4">Nuevo proveedor</h2>
        <form action={handleCreate} className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Nombre *</label>
            <input name="name" required placeholder="ej: Microsoft"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Categoría</label>
            <select name="category" defaultValue=""
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]">
              <option value="">Sin categoría</option>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="cloud">Cloud / Hosting</option>
              <option value="telecom">Telecomunicaciones</option>
              <option value="consulting">Consultoría</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Contacto</label>
            <input name="contact_name" placeholder="Nombre del contacto"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Email contacto</label>
            <input name="contact_email" type="email" placeholder="vendor@empresa.com"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Teléfono</label>
            <input name="contact_phone" placeholder="+57 300 000 0000"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1">Sitio web</label>
            <input name="website" type="url" placeholder="https://vendor.com"
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
          </div>
          <div className="col-span-3 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Agregar proveedor
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {list.length > 0 ? (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                {['Proveedor', 'Categoría', 'Contacto', 'Email', 'Contratos', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((v: any) => (
                <tr key={v.id} className="border-b border-[#334155]/50 hover:bg-[#263248]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#F1F5F9]">{v.name}</p>
                    {v.website && (
                      <a href={v.website} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1">
                        <ExternalLink size={10} /> {v.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {v.category ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[v.category] ?? CATEGORY_COLORS.other}`}>
                        {v.category}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{v.contact_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{v.contact_email ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{v.vendor_contracts?.[0]?.count ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link href={`/admin/vendors/${v.id}`}
                        className="px-2 py-1 rounded text-xs bg-[#334155] hover:bg-[#475569] text-[#F1F5F9] transition-colors">
                        Contratos
                      </Link>
                      <form action={handleDelete.bind(null, v.id)}>
                        <button type="submit" className="p-1.5 rounded text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-12 text-center">
          <Building2 size={32} className="text-[#334155] mx-auto mb-3" />
          <p className="text-[#64748B] text-sm">Sin proveedores registrados.</p>
        </div>
      )}
    </div>
  )
}
