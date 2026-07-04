import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Star } from 'lucide-react'

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: survey } = await supabase.from('surveys').select('*').eq('id', id).single()
  if (!survey || !survey.is_active) redirect('/client/dashboard')

  const { data: existing } = await supabase
    .from('survey_responses')
    .select('id')
    .eq('survey_id', id)
    .eq('respondent_id', user.id)
    .single()

  if (existing) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center space-y-4">
        <Star size={40} className="text-[#F59E0B] mx-auto" />
        <h2 className="text-xl font-semibold text-[#1E293B]">¡Gracias por tu respuesta!</h2>
        <p className="text-[#64748B]">Ya respondiste esta encuesta.</p>
      </div>
    )
  }

  async function handleSubmit(formData: FormData) {
    'use server'
    const supabase = await (await import('@/lib/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('survey_responses').insert({
      survey_id: id,
      respondent_id: user?.id,
      score: parseInt(formData.get('score') as string),
      comment: formData.get('comment') as string || null,
    })
    revalidatePath(`/client/survey/${id}`)
    redirect(`/client/survey/${id}`)
  }

  const isNps = survey.survey_type === 'nps'
  const isCsat = survey.survey_type === 'csat'
  const scale = isNps ? 11 : isCsat ? 5 : 10

  return (
    <div className="max-w-lg mx-auto mt-12 space-y-6">
      <div className="text-center">
        <Star size={32} className="text-[#F59E0B] mx-auto mb-3" />
        <h1 className="text-xl font-semibold text-[#1E293B]">{survey.name}</h1>
        {survey.description && <p className="text-sm text-[#64748B] mt-1">{survey.description}</p>}
      </div>

      <form action={handleSubmit} className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-[#1E293B] mb-3">
            {isNps
              ? '¿Qué tan probable es que nos recomiendes? (0 = Nada probable · 10 = Muy probable)'
              : isCsat
              ? '¿Cómo calificarías tu experiencia? (1 = Muy malo · 5 = Excelente)'
              : 'Tu puntuación'}
          </label>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: scale }, (_, i) => (
              <label key={i} className="cursor-pointer">
                <input type="radio" name="score" value={i} required className="sr-only peer" />
                <span className={`flex items-center justify-center w-10 h-10 rounded-lg border text-sm font-medium transition-all
                  peer-checked:bg-[#3B82F6] peer-checked:border-[#3B82F6] peer-checked:text-white
                  ${isNps && i >= 9 ? 'border-[#10B981]/50 text-[#10B981]' : isNps && i >= 7 ? 'border-[#F59E0B]/50 text-[#F59E0B]' : 'border-[#E6EBF2] text-[#64748B]'}
                  hover:border-[#3B82F6] hover:text-[#3B82F6]`}>
                  {i}
                </span>
              </label>
            ))}
          </div>
          {isNps && (
            <div className="flex justify-between text-xs text-[#CBD5E1] mt-2">
              <span>Nada probable</span>
              <span>Muy probable</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-[#64748B] mb-1">Comentario adicional (opcional)</label>
          <textarea name="comment" rows={3} placeholder="¿Qué podemos mejorar?"
            className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#1E293B] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#CBD5E1] resize-none" />
        </div>

        <button type="submit"
          className="w-full py-2.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors">
          Enviar respuesta
        </button>
      </form>
    </div>
  )
}
