'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveView(name: string, filters: Record<string, string>, isShared: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('saved_views').insert({ name, filters, is_shared: isShared, owner_id: user.id })
  revalidatePath('/agent/tickets')
  revalidatePath('/admin/tickets')
}

export async function deleteView(id: string) {
  const supabase = await createClient()
  await supabase.from('saved_views').delete().eq('id', id)
  revalidatePath('/agent/tickets')
  revalidatePath('/admin/tickets')
}
