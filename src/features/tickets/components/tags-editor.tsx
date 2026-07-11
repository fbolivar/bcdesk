'use client'

import { useState } from 'react'
import { X, Tag } from 'lucide-react'

interface Props {
  ticketId: string
  initialTags: string[]
  onUpdate: (ticketId: string, tags: string[]) => Promise<void>
}

export function TagsEditor({ ticketId, initialTags, onUpdate }: Props) {
  const [tags, setTags] = useState<string[]>(initialTags ?? [])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  async function addTag() {
    const val = input.trim().toLowerCase().replace(/\s+/g, '-')
    if (!val || tags.includes(val)) { setInput(''); return }
    const next = [...tags, val]
    setTags(next)
    setInput('')
    setSaving(true)
    await onUpdate(ticketId, next)
    setSaving(false)
  }

  async function removeTag(tag: string) {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    setSaving(true)
    await onUpdate(ticketId, next)
    setSaving(false)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[#5B6B7C] flex items-center gap-1">
        <Tag size={11} /> Etiquetas {saving && <span className="text-[#0E9E86]">(guardando...)</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#E6EBF2] text-[#5B6B7C]">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-[#EF4444] transition-colors">
              <X size={10} />
            </button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-[10px] text-[#5B6B7C]">Sin etiquetas</span>}
      </div>
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
          placeholder="Nueva etiqueta..."
          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#00D4AA] text-xs"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-3 py-1.5 rounded-lg bg-[#E6EBF2] hover:bg-[#00D4AA] text-[#5B6B7C] hover:text-white text-xs transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}
