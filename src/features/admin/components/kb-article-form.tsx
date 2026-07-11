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
          ? 'p-1.5 rounded text-[#5B6B7C] hover:text-[#0E9E86] hover:bg-[#00D4AA]/10 transition-colors'
          : 'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] text-sm font-medium transition-colors'}>
        {article ? <Pencil size={14} /> : <><Plus size={14} /> Nuevo artículo</>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E6EBF2]">
              <h3 className="text-sm font-semibold text-[#0B2545]">
                {article ? 'Editar artículo' : 'Nuevo artículo'}
              </h3>
              <button onClick={() => setOpen(false)} className="text-[#5B6B7C] hover:text-[#0B2545]">
                <X size={16} />
              </button>
            </div>
            <form action={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-[#5B6B7C] mb-1">Título *</label>
                <input name="title" required defaultValue={article?.title}
                  className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA]" />
              </div>
              <div>
                <label className="block text-xs text-[#5B6B7C] mb-1">Categoría</label>
                <input name="category" defaultValue={article?.category ?? ''}
                  placeholder="ej: Facturación, Soporte técnico"
                  className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] placeholder-[#CBD5E1]" />
              </div>
              <div>
                <label className="block text-xs text-[#5B6B7C] mb-1">Contenido *</label>
                <textarea name="content" required rows={10}
                  defaultValue={article ? undefined : ''}
                  className="w-full px-3 py-2 bg-[#F4F7FB] border border-[#E6EBF2] rounded-lg text-[#0B2545] text-sm focus:outline-none focus:border-[#00D4AA] font-mono resize-y" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_published" value="true" id="pub"
                  defaultChecked={article?.is_published ?? false}
                  className="w-4 h-4 rounded" />
                <label htmlFor="pub" className="text-sm text-[#5B6B7C]">Publicar inmediatamente</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-[#5B6B7C] hover:text-[#0B2545] border border-[#E6EBF2] hover:border-[#CBD5E1] transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00D4AA] hover:bg-[#00B392] text-[#0B2545] transition-colors">
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
