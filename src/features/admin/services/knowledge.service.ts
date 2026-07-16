'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createKbArticle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const title = formData.get('title') as string
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  await supabase.from('kb_articles').insert({
    title,
    slug,
    content: formData.get('content') as string,
    category: formData.get('category') as string || null,
    is_published: formData.get('is_published') === 'true',
    author_id: user.id,
  })
  revalidatePath('/admin/knowledge')
}

export async function updateKbArticle(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const title = formData.get('title') as string
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const content = formData.get('content') as string

  // Se necesita el título y la categoría actuales: el snapshot guarda la versión
  // COMPLETA anterior, y title/content son obligatorios en kb_article_versions.
  const { data: current } = await supabase
    .from('kb_articles').select('title, content, category, current_version').eq('id', id).single()
  const nextVersion = (current?.current_version ?? 0) + 1

  // Snapshot de la versión previa. La columna es `version`, no `version_number`,
  // y title/content son NOT NULL: antes el insert fallaba siempre, el error se
  // ignoraba y el artículo se sobrescribía igual, así que la versión anterior se
  // perdía para siempre pese a que current_version subía.
  if (current) {
    const { error: verErr } = await supabase.from('kb_article_versions').insert({
      article_id: id,
      version: nextVersion,
      title: current.title,
      content: current.content ?? '',
      category: current.category,
      edited_by: user?.id,
      change_summary: formData.get('change_summary') as string || null,
    })
    // Sin snapshot no se sobrescribe: perder el historial es peor que no guardar.
    if (verErr) throw new Error('No se pudo guardar el historial de versiones. El artículo no se modificó.')
  }

  const { error: updErr } = await supabase.from('kb_articles').update({
    title,
    slug,
    content,
    category: formData.get('category') as string || null,
    is_published: formData.get('is_published') === 'true',
    current_version: nextVersion,
  }).eq('id', id)
  if (updErr) throw new Error('No se pudo guardar el artículo.')

  revalidatePath('/admin/knowledge')
}

export async function toggleKbArticle(id: string, published: boolean) {
  const supabase = await createClient()
  await supabase.from('kb_articles').update({ is_published: published }).eq('id', id)
  revalidatePath('/admin/knowledge')
}

export async function deleteKbArticle(id: string) {
  const supabase = await createClient()
  await supabase.from('kb_articles').delete().eq('id', id)
  revalidatePath('/admin/knowledge')
}
