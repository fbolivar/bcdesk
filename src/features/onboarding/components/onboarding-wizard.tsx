'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react'
import type { OnboardingSubmission } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

const STEPS = [
  { id: 1, label: 'Empresa' },
  { id: 2, label: 'Contactos' },
  { id: 3, label: 'Servicios' },
  { id: 4, label: 'Confirmación' },
]

const companySchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  industry: z.string().min(2, 'Industria requerida'),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  phone: z.string().min(7, 'Teléfono requerido'),
  address: z.string().min(5, 'Dirección requerida'),
})

const contactsSchema = z.object({
  primary_name: z.string().min(2, 'Nombre requerido'),
  primary_email: z.string().email('Email inválido'),
  primary_phone: z.string().min(7, 'Teléfono requerido'),
  technical_name: z.string().optional(),
  technical_email: z.string().email('Email inválido').optional().or(z.literal('')),
})

const servicesSchema = z.object({
  services: z.array(z.string()).min(1, 'Selecciona al menos un servicio'),
  notes: z.string().optional(),
})

type CompanyData = z.infer<typeof companySchema>
type ContactsData = z.infer<typeof contactsSchema>
type ServicesData = z.infer<typeof servicesSchema>

const SERVICES = [
  'Desarrollo de software a medida',
  'Mantenimiento de sistemas',
  'Consultoría técnica',
  'Soporte y helpdesk',
  'Integración de sistemas',
  'Migración de datos',
  'Auditoría de código',
  'Capacitación técnica',
]

interface Props {
  organizationId: string
  userId: string
  existingSubmission: OnboardingSubmission | null
}

export function OnboardingWizard({ organizationId, userId, existingSubmission }: Props) {
  const isCompleted = !!existingSubmission?.completed_at
  const [step, setStep] = useState(isCompleted ? 4 : (existingSubmission?.step_completed ?? 0) + 1)
  const [companyData, setCompanyData] = useState<CompanyData | null>(
    (existingSubmission?.company_data as CompanyData) ?? null
  )
  const [contactsData, setContactsData] = useState<ContactsData | null>(
    (existingSubmission?.contacts_data as ContactsData) ?? null
  )
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(isCompleted)

  const supabase = createClient()

  async function saveStep(stepNum: number, data: Record<string, unknown>) {
    const payload: Record<string, unknown> = {
      organization_id: organizationId,
      submitted_by: userId,
      step_completed: stepNum,
    }
    if (stepNum >= 1) payload.company_data = companyData
    if (stepNum >= 2) payload.contacts_data = contactsData
    if (stepNum >= 3) payload.services_data = data
    if (stepNum === 3) payload.completed_at = new Date().toISOString()

    if (existingSubmission) {
      await supabase.from('onboarding_submissions').update(payload).eq('id', existingSubmission.id)
    } else {
      await supabase.from('onboarding_submissions').insert(payload)
    }
  }

  const Step1Form = () => {
    const { register, handleSubmit, formState: { errors } } = useForm<CompanyData>({
      resolver: zodResolver(companySchema),
      defaultValues: companyData ?? {},
    })
    const onSubmit = async (data: CompanyData) => {
      setSaving(true)
      setCompanyData(data)
      setSaving(false)
      setStep(2)
    }
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Nombre de la empresa *</label>
            <input {...register('name')} className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors" />
            {errors.name && <p className="mt-1 text-xs text-[#EF4444]">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Industria *</label>
            <input {...register('industry')} placeholder="ej: Retail, Fintech, Salud" className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors" />
            {errors.industry && <p className="mt-1 text-xs text-[#EF4444]">{errors.industry.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Teléfono *</label>
            <input {...register('phone')} className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors" />
            {errors.phone && <p className="mt-1 text-xs text-[#EF4444]">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Sitio web</label>
            <input {...register('website')} placeholder="https://miempresa.com" className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Dirección *</label>
            <input {...register('address')} className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors" />
            {errors.address && <p className="mt-1 text-xs text-[#EF4444]">{errors.address.message}</p>}
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors disabled:opacity-50">
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      </form>
    )
  }

  const Step2Form = () => {
    const { register, handleSubmit, formState: { errors } } = useForm<ContactsData>({
      resolver: zodResolver(contactsSchema),
      defaultValues: contactsData ?? {},
    })
    const onSubmit = async (data: ContactsData) => {
      setSaving(true)
      setContactsData(data)
      setSaving(false)
      setStep(3)
    }
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-[#5B6B7C] mb-3">Contacto principal</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Nombre *</label>
              <input {...register('primary_name')} className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors" />
              {errors.primary_name && <p className="mt-1 text-xs text-[#EF4444]">{errors.primary_name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Email *</label>
              <input {...register('primary_email')} type="email" className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors" />
              {errors.primary_email && <p className="mt-1 text-xs text-[#EF4444]">{errors.primary_email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Teléfono *</label>
              <input {...register('primary_phone')} className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors" />
              {errors.primary_phone && <p className="mt-1 text-xs text-[#EF4444]">{errors.primary_phone.message}</p>}
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-[#E6EBF2]/50">
          <p className="text-sm font-semibold text-[#5B6B7C] mb-3">Contacto técnico (opcional)</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Nombre</label>
              <input {...register('technical_name')} className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Email</label>
              <input {...register('technical_email')} type="email" className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors" />
            </div>
          </div>
        </div>
        <div className="flex justify-between pt-2">
          <button type="button" onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-[#5B6B7C] hover:text-[#0B2545] border border-[#E6EBF2] hover:bg-[#EEF2F7] transition-colors">
            <ChevronLeft size={16} /> Anterior
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-sm font-medium transition-colors disabled:opacity-50">
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      </form>
    )
  }

  const Step3Form = () => {
    const [selected, setSelected] = useState<string[]>([])
    const { register, handleSubmit, setValue, formState: { errors } } = useForm<ServicesData>({
      resolver: zodResolver(servicesSchema),
      defaultValues: { services: [] },
    })
    const toggleService = (s: string) => {
      const next = selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s]
      setSelected(next)
      setValue('services', next, { shouldValidate: true })
    }
    const onSubmit = async (data: ServicesData) => {
      setSaving(true)
      await saveStep(3, data)
      setSaving(false)
      setDone(true)
      setStep(4)
    }
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <p className="text-sm font-medium text-[#5B6B7C] mb-3">Servicios contratados *</p>
          <div className="grid grid-cols-2 gap-2">
            {SERVICES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleService(s)}
                className={`px-3 py-2.5 rounded-lg text-sm text-left transition-colors border ${
                  selected.includes(s)
                    ? 'bg-[#1789FC]/20 border-[#1789FC] text-[#1789FC]'
                    : 'bg-[#F4F7FB] border-[#E6EBF2] text-[#5B6B7C] hover:border-[#1789FC]/50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {errors.services && <p className="mt-1 text-xs text-[#EF4444]">{errors.services.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5B6B7C] mb-1.5">Notas adicionales</label>
          <textarea {...register('notes')} rows={3} placeholder="Contexto adicional sobre tus necesidades..." className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors resize-none text-sm" />
        </div>
        <div className="flex justify-between pt-2">
          <button type="button" onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-[#5B6B7C] hover:text-[#0B2545] border border-[#E6EBF2] hover:bg-[#EEF2F7] transition-colors">
            <ChevronLeft size={16} /> Anterior
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-sm font-medium transition-colors disabled:opacity-50">
            Completar onboarding <CheckCircle2 size={16} />
          </button>
        </div>
      </form>
    )
  }

  if (done) {
    return (
      <div className="bg-[#FFFFFF] border border-[#10B981]/30 rounded-xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={24} className="text-[#10B981]" />
        </div>
        <h2 className="text-lg font-semibold text-[#0B2545]">¡Onboarding completado!</h2>
        <p className="text-sm text-[#5B6B7C] mt-2">Tu información ha sido registrada. El equipo BC revisará tus datos y te contactará pronto.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 ${step > s.id ? 'text-[#10B981]' : step === s.id ? 'text-[#1789FC]' : 'text-[#5B6B7C]'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                step > s.id ? 'bg-[#10B981] border-[#10B981] text-white' :
                step === s.id ? 'bg-[#1789FC]/20 border-[#1789FC] text-[#1789FC]' :
                'bg-transparent border-[#E6EBF2] text-[#5B6B7C]'
              }`}>
                {step > s.id ? '✓' : s.id}
              </div>
              <span className="text-xs font-medium hidden sm:block">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px w-6 ${step > s.id ? 'bg-[#10B981]' : 'bg-[#E6EBF2]'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl p-6">
        {step === 1 && <Step1Form />}
        {step === 2 && <Step2Form />}
        {step === 3 && <Step3Form />}
      </div>
    </div>
  )
}
