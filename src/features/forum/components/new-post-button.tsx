'use client'

import { useState, useRef } from 'react'
import { createForumPost } from '../services/forum.actions'
import { Plus, X, Loader2 } from 'lucide-react'

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'technical', label: 'Técnico' },
  { value: 'billing', label: 'Facturación' },
  { value: 'feature_request', label: 'Solicitud de función' },
  { value: 'announcement', label: 'Anuncio' },
]

export function NewPostButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    try {
      await createForumPost(formData)
      setOpen(false)
      formRef.current?.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al publicar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
        style={{ background: '#00D4AA', color: '#0B2545' }}
      >
        <Plus size={16} />
        Nueva pregunta
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-lg rounded-2xl p-6 shadow-2xl"
            style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: '#0B2545' }}>Nueva pregunta</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#5B6B7C' }}
              >
                <X size={18} />
              </button>
            </div>

            <form ref={formRef} action={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#5B6B7C' }}>
                  Título
                </label>
                <input
                  name="title"
                  required
                  minLength={5}
                  maxLength={200}
                  placeholder="¿Cuál es tu pregunta o tema?"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: '#F4F7FB',
                    border: '1px solid #E6EBF2',
                    color: '#0B2545',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#5B6B7C' }}>
                  Categoría
                </label>
                <select
                  name="category"
                  required
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: '#F4F7FB',
                    border: '1px solid #E6EBF2',
                    color: '#0B2545',
                  }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#5B6B7C' }}>
                  Descripción
                </label>
                <textarea
                  name="body"
                  required
                  minLength={10}
                  rows={5}
                  placeholder="Describe tu pregunta o comparte tu información..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
                  style={{
                    background: '#F4F7FB',
                    border: '1px solid #E6EBF2',
                    color: '#0B2545',
                  }}
                />
              </div>

              {error && (
                <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ color: '#5B6B7C', border: '1px solid #E6EBF2' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
                  style={{ background: '#00D4AA', color: '#0B2545' }}
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Publicar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
