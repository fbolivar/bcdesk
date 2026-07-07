'use client'

import { useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'

export function PayButton({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handlePay} disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] text-white text-xs font-medium transition-colors disabled:opacity-50">
      {loading ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
      Pagar online
    </button>
  )
}
