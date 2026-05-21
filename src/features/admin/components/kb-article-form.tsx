'use client'

import { useState } from 'react'
import { Plus, Pencil, X } from 'lucide-react'

interface Article {
  id: string
  title: string
  slug: string
  category: string | null
  is_published: boolean
}

interface Props {
  article?: Article
  action: (formData: FormData) => Promise<void>
}

export function KbArticleForm({ article, action }: Props) {
  const [open, setOpen] = useState(false)

  async function handleSubmit(formData: FormData) {
    await action(formData)
    setOpen(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={article
          ? 'p-1.5 rounded text-[#64748B] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-colors'
          : 'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-medium transition-colors'}>
        {article ? <Pencil size={14} /> : <><Plus size={14} /> Nuevo artículo</>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#334155]">
              <h3 className="text-sm font-semibold text-[#F1F5F9]">
                {article ? 'Editar artículo' : 'Nuevo artículo'}
              </h3>
              <button onClick={() => setOpen(false)} className="text-[#64748B] hover:text-[#F1F5F9]">
                <X size={16} />
              </button>
            </div>
            <form action={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Título *</label>
                <input name="title" required defaultValue={article?.title}
                  className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6]" />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Categoría</label>
                <input name="category" defaultValue={article?.category ?? ''}
                  placeholder="ej: Facturación, Soporte técnico"
                  className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] placeholder-[#475569]" />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">Contenido *</label>
                <textarea name="content" required rows={10}
                  defaultValue={article ? undefined : ''}
                  className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] font-mono resize-y" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_published" value="true" id="pub"
                  defaultChecked={article?.is_published ?? false}
                  className="w-4 h-4 rounded" />
                <label htmlFor="pub" className="text-sm text-[#94A3B8]">Publicar inmediatamente</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-[#94A3B8] hover:text-[#F1F5F9] border border-[#334155] hover:border-[#475569] transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[#3B82F6] hover:bg-[#2563EB] text-white transition-colors">
                  {article ? 'Guardar cambios' : 'Crear artículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
