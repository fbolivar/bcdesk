'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const HARDCODED = [
  { id: 'h1', title: 'Acuse de recibo', content: 'Hemos recibido tu solicitud y la estamos procesando. Te contactaremos a la brevedad.' },
  { id: 'h2', title: 'Solicitar más info', content: 'Para poder ayudarte mejor, ¿podrías proporcionarnos más detalles sobre el problema?' },
  { id: 'h3', title: 'Problema resuelto', content: 'Hemos solucionado el problema. Por favor confírmanos si todo está funcionando correctamente.' },
  { id: 'h4', title: 'Escalado', content: 'Tu caso ha sido escalado a nuestro equipo especializado. Te contactaremos a la brevedad con una solución.' },
  { id: 'h5', title: 'En proceso', content: 'Estamos trabajando activamente en tu caso. Te mantendremos informado de cualquier avance.' },
]

interface CannedResponse {
  id: string
  title: string
  content: string
  category: string | null
}

interface Props {
  name: string
  placeholder?: string
  rows?: number
  cannedResponses?: CannedResponse[]
}

export function QuickReplyTextarea({ name, placeholder = 'Escribe un comentario...', rows = 4, cannedResponses = [] }: Props) {
  const [value, setValue] = useState('')
  const [showAll, setShowAll] = useState(false)

  const all = [...HARDCODED, ...cannedResponses]
  const visible = showAll ? all : all.slice(0, 5)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-[#5B6B7C]">Respuestas rápidas:</span>
        {visible.map(qr => (
          <button
            key={qr.id}
            type="button"
            onClick={() => setValue(qr.content)}
            title={qr.content}
            className="text-[10px] px-2.5 py-1 rounded-full bg-[#E6EBF2] text-[#5B6B7C] hover:bg-[#1789FC]/20 hover:text-[#1789FC] transition-colors max-w-[140px] truncate"
          >
            {qr.title}
          </button>
        ))}
        {all.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className="text-[10px] text-[#5B6B7C] hover:text-[#5B6B7C] flex items-center gap-0.5 transition-colors"
          >
            {showAll ? 'Menos' : `+${all.length - 5} más`}
            <ChevronDown size={10} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      <textarea
        name={name}
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] focus:ring-1 focus:ring-[#1789FC] transition-colors resize-none text-sm"
      />
    </div>
  )
}
