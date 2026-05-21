'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCatalogItem(formData: FormData) {
  const supabase = await createClient()
  await supabase.from('service_catalog_items').insert({
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    category: formData.get('category') as string || 'general',
    icon: formData.get('icon') as string || '🎫',
    default_priority: formData.get('default_priority') as string || 'medium',
    sla_hours: parseInt(formData.get('sla_hours') as string) || 24,
    sort_order: parseInt(formData.get('sort_order') as string) || 0,
  })
  revalidatePath('/admin/settings/catalog')
}

export async function updateCatalogItem(id: string, formData: FormData) {
  const supabase = await createClient()
  await supabase.from('service_catalog_items').update({
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    category: formData.get('category') as string || 'general',
    icon: formData.get('icon') as string || '🎫',
    default_priority: formData.get('default_priority') as string || 'medium',
    sla_hours: parseInt(formData.get('sla_hours') as string) || 24,
    sort_order: parseInt(formData.get('sort_order') as string) || 0,
  }).eq('id', id)
  revalidatePath('/admin/settings/catalog')
}

export async function toggleCatalogItem(id: string, current: boolean) {
  const supabase = await createClient()
  await supabase.from('service_catalog_items').update({ is_active: !current }).eq('id', id)
  revalidatePath('/admin/settings/catalog')
}

export async function deleteCatalogItem(id: string) {
  const supabase = await createClient()
  await supabase.from('service_catalog_items').delete().eq('id', id)
  revalidatePath('/admin/settings/catalog')
}
