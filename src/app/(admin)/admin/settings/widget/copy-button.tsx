'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#94A3B8] transition-colors">
      {copied ? <Check size={12} className="text-[#10B981]" /> : <Copy size={12} />}
      {copied ? 'Copiado' : label}
    </button>
  )
}
