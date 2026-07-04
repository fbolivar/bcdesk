import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImpactAnalyzer } from '@/features/admin/components/impact-analyzer'

export default async function AssetImpactPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'agent'].includes(myProfile?.role ?? '')) redirect('/dashboard')

  const { data: assets } = await supabase
    .from('assets')
    .select('id, name, asset_type')
    .order('name', { ascending: true })

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]">Análisis de impacto</h1>
        <p className="text-sm text-[#64748B] mt-0.5">
          Calcula el blast radius: qué activos, tickets y organizaciones se afectan si un CI falla.
        </p>
      </div>

      <ImpactAnalyzer assets={assets ?? []} />
    </div>
  )
}
