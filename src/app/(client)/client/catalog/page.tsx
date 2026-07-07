import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Grid3X3 } from 'lucide-react'

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente',
}
const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-[#5B6B7C]', medium: 'text-[#1789FC]', high: 'text-[#F59E0B]', urgent: 'text-[#EF4444]',
}

export default async function ClientCatalogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: items } = await supabase
    .from('service_catalog_items')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  const list = items ?? []
  const categories = [...new Set(list.map(i => i.category))]

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#0B2545]">Catálogo de servicios</h1>
        <p className="text-sm text-[#5B6B7C] mt-0.5">Selecciona el tipo de solicitud que mejor describe tu necesidad</p>
      </div>

      {categories.map(cat => (
        <div key={cat}>
          <h2 className="text-xs font-semibold text-[#5B6B7C] uppercase tracking-wide mb-3 flex items-center gap-2">
            <Grid3X3 size={12} /> {cat}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.filter(i => i.category === cat).map(item => (
              <Link key={item.id} href={`/client/catalog/${item.id}`}
                className="bg-[#FFFFFF] border border-[#E6EBF2] hover:border-[#1789FC] rounded-xl p-4 transition-all hover:bg-[#EEF2F7] group">
                <div className="text-2xl mb-2">{item.icon}</div>
                <h3 className="font-medium text-[#0B2545] group-hover:text-[#1789FC] transition-colors">{item.name}</h3>
                {item.description && (
                  <p className="text-xs text-[#5B6B7C] mt-1 line-clamp-2">{item.description}</p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <span className={`text-xs font-medium ${PRIORITY_COLOR[item.default_priority]}`}>
                    Prioridad {PRIORITY_LABEL[item.default_priority]}
                  </span>
                  <span className="text-xs text-[#CBD5E1]">SLA {item.sla_hours}h</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {list.length === 0 && (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-12 text-center">
          <Grid3X3 size={32} className="text-[#E6EBF2] mx-auto mb-3" />
          <p className="text-[#5B6B7C] text-sm">No hay servicios disponibles por ahora.</p>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-[#E6EBF2]">
        <p className="text-sm text-[#5B6B7C]">
          ¿No encuentras lo que necesitas?{' '}
          <Link href="/client/tickets/new" className="text-[#1789FC] hover:underline">
            Crea un ticket general
          </Link>
        </p>
      </div>
    </div>
  )
}
