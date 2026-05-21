'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCustomField(formData: FormData) {
  const supabase = await createClient()
  const name = formData.get('name') as string
  const field_key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')
  const rawOptions = formData.get('options') as string

  await supabase.from('custom_fields').insert({
    name,
    field_key,
    field_type: formData.get('field_type') as string,
    options: rawOptions ? rawOptions.split(',').map(o => o.trim()).filter(Boolean) : null,
    category: formData.get('category') as string || null,
    required: formData.get('required') === 'true',
  })
  revalidatePath('/admin/settings/fields')
}

export async function deleteCustomField(id: string) {
  const supabase = await createClient()
  await supabase.from('custom_fields').delete().eq('id', id)
  revalidatePath('/admin/settings/fields')
}

export async function toggleCustomField(id: string, active: boolean) {
  const supabase = await createClient()
  await supabase.from('custom_fields').update({ is_active: active }).eq('id', id)
  revalidatePath('/admin/settings/fields')
}

export async function saveCustomValue(ticketId: string, fieldId: string, value: string) {
  const supabase = await createClient()
  await supabase.from('ticket_custom_values').upsert(
    { ticket_id: ticketId, field_id: fieldId, value },
    { onConflict: 'ticket_id,field_id' }
  )
  revalidatePath(`/agent/tickets/${ticketId}`)
}
