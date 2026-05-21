'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function requireTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'agent'].includes(profile.role)) throw new Error('Sin permisos')
  return { supabase, user }
}

export async function createCannedResponse(formData: FormData) {
  const { supabase, user } = await requireTeam()
  await supabase.from('canned_responses').insert({
    title: formData.get('title') as string,
    content: formData.get('content') as string,
    category: (formData.get('category') as string) || null,
    created_by: user.id,
  })
  revalidatePath('/admin/settings/canned')
}

export async function updateCannedResponse(formData: FormData) {
  const { supabase } = await requireTeam()
  const id = formData.get('id') as string
  await supabase.from('canned_responses').update({
    title: formData.get('title') as string,
    content: formData.get('content') as string,
    category: (formData.get('category') as string) || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  revalidatePath('/admin/settings/canned')
}

export async function toggleCannedResponse(formData: FormData) {
  const { supabase } = await requireTeam()
  const id = formData.get('id') as string
  const current = formData.get('is_active') === 'true'
  await supabase.from('canned_responses').update({ is_active: !current }).eq('id', id)
  revalidatePath('/admin/settings/canned')
}

export async function deleteCannedResponse(formData: FormData) {
  const { supabase } = await requireTeam()
  const id = formData.get('id') as string
  await supabase.from('canned_responses').delete().eq('id', id)
  revalidatePath('/admin/settings/canned')
}
