'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
      <Printer size={14} /> Imprimir / Guardar PDF
    </button>
  )
}
