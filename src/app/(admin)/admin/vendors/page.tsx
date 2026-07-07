import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { Building2, Plus, Trash2, ExternalLink } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  hardware: 'bg-[#1789FC]/20 text-[#1789FC]',
  software: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
  cloud: 'bg-[#06B6D4]/20 text-[#06B6D4]',
  telecom: 'bg-[#10B981]/20 text-[#10B981]',
  consulting: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  other: 'bg-[#E6EBF2] text-[#5B6B7C]',
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
        <h1 className="text-xl font-semibold text-[#0B2545]">Gestión de proveedores</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Vendors IT, contratos y SLAs de terceros</p>
      </div>

      {/* Create */}
      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0B2545] mb-4">Nuevo proveedor</h2>
        <form action={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Nombre *</label>
            <input name="name" required placeholder="ej: Microsoft"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Categoría</label>
            <select name="category" defaultValue=""
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC]">
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
            <label className="block text-xs text-[#5B6B7C] mb-1">Contacto</label>
            <input name="contact_name" placeholder="Nombre del contacto"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Email contacto</label>
            <input name="contact_email" type="email" placeholder="vendor@empresa.com"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Teléfono</label>
            <input name="contact_phone" placeholder="+57 300 000 0000"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div>
            <label className="block text-xs text-[#5B6B7C] mb-1">Sitio web</label>
            <input name="website" type="url" placeholder="https://vendor.com"
              className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#1789FC] placeholder-[#CBD5E1]" />
          </div>
          <div className="col-span-3 flex justify-end">
            <button type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors">
              <Plus size={14} /> Agregar proveedor
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {list.length > 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <div className="w-full overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Proveedor', 'Categoría', 'Contacto', 'Email', 'Contratos', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#5B6B7C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((v: any) => (
                <tr key={v.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#0B2545]">{v.name}</p>
                    {v.website && (
                      <a href={v.website} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#1789FC] hover:underline flex items-center gap-1">
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
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{v.contact_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{v.contact_email ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#5B6B7C]">{v.vendor_contracts?.[0]?.count ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link href={`/admin/vendors/${v.id}`}
                        className="px-2 py-1 rounded text-xs bg-[#E6EBF2] hover:bg-[#CBD5E1] text-[#0B2545] transition-colors">
                        Contratos
                      </Link>
                      <form action={handleDelete.bind(null, v.id)}>
                        <button type="submit" className="p-1.5 rounded text-[#5B6B7C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Building2 size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">Sin proveedores registrados.</p>
        </div>
      )}
    </div>
  )
}
