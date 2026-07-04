'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar link"
      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[#E6EBF2] text-[#64748B] hover:text-[#1E293B] hover:border-[#3B82F6]/40 transition-colors"
    >
      {copied ? <Check size={12} className="text-[#10B981]" /> : <Copy size={12} />}
      {copied ? 'Copiado' : 'Copiar link'}
    </button>
  )
}
