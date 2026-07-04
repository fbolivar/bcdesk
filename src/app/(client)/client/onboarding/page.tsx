import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from '@/features/onboarding/components/onboarding-wizard'
import { ClipboardList, CheckCircle2, Clock, Users } from 'lucide-react'

export default async function ClientOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('organization_id').eq('id', user.id).single()

  if (!profile?.organization_id) redirect('/client/dashboard')

  const { data: submission } = await supabase
    .from('onboarding_submissions')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .single()

  const isCompleted = !!submission?.completed_at

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header explicativo */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#0F172A' }}>
          Proceso de bienvenida
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
          Configura tu organización para aprovechar todos los servicios de BC Fabric
        </p>
      </div>

      {/* Tarjeta informativa — solo si no está completado */}
      {!isCompleted && (
        <div className="rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4"
          style={{ background: 'rgba(79,138,255,0.06)', border: '1px solid rgba(79,138,255,0.2)' }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(79,138,255,0.15)' }}>
              <ClipboardList size={15} style={{ color: '#4F8AFF' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>¿Qué es esto?</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                Registro inicial de tu empresa para activar todos los servicios contratados.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(16,217,138,0.15)' }}>
              <Clock size={15} style={{ color: '#10D98A' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>5 minutos</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                Solo necesitas completar 3 pasos rápidos: empresa, contactos y servicios.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(139,111,255,0.15)' }}>
              <Users size={15} style={{ color: '#8B6FFF' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>Siguiente paso</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                El equipo BC revisará tu información y te contactará en menos de 24 horas.
              </p>
            </div>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(16,217,138,0.08)', border: '1px solid rgba(16,217,138,0.25)' }}>
          <CheckCircle2 size={18} style={{ color: '#10D98A' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: '#10D98A' }}>Onboarding completado</p>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
              Tu información fue registrada el {new Date(submission.completed_at!).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}.
              El equipo BC ya tiene todo lo necesario para brindarte soporte.
            </p>
          </div>
        </div>
      )}

      <OnboardingWizard
        organizationId={profile.organization_id}
        userId={user.id}
        existingSubmission={submission}
      />
    </div>
  )
}
