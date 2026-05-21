'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

export async function login(email: string, password: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  await supabase.from('profiles').update({ last_login_at: new Date().toISOString() })
    .eq('id', (await supabase.auth.getUser()).data.user!.id)

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function register(email: string, password: string, fullName: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) return { error: error.message }
  redirect('/dashboard')
}

export async function registerWithInvite(token: string, password: string, fullName: string) {
  const supabase = await createClient()

  // Delegate all admin operations to the Edge Function (has built-in service role key)
  const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/complete-invite`
  const fnRes = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password, fullName }),
  })

  const fnData = await fnRes.json()
  if (!fnRes.ok || fnData.error) {
    return { error: fnData.error ?? 'Error al completar el registro' }
  }

  // Sign in to create session now that the user/password is set
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: fnData.email,
    password,
  })

  if (signInError) return { error: 'Cuenta creada. Inicia sesión para continuar.' }

  redirect('/dashboard')
}

export async function getInvitationByToken(token: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invitations')
    .select('*, organizations(name, logo_url)')
    .eq('token', token)
    .is('accepted_at', null)
    .single()

  if (error) return null
  return data
}
