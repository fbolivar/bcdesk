'use client'

import { useState } from 'react'

const EMOJIS = ['😞', '😕', '😐', '🙂', '😄']
const LABELS = ['Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente']

interface Props {
  onRate: (score: number, comment: string) => Promise<void>
}

export function CsatRating({ onRate }: Props) {
  const [hover, setHover] = useState(0)
  const [selected, setSelected] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (!selected) return
    setSubmitting(true)
    await onRate(selected, comment)
    setDone(true)
  }

  if (done) {
    return (
      <p className="text-sm text-center text-[#10B981]">
        ¡Gracias por tu calificación! Tu feedback nos ayuda a mejorar.
      </p>
    )
  }

  const active = hover || selected

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#5B6B7C] text-center">¿Cómo calificarías la atención recibida?</p>
      <div className="flex justify-center gap-3">
        {EMOJIS.map((emoji, i) => {
          const score = i + 1
          return (
            <button
              key={score}
              type="button"
              onClick={() => setSelected(score)}
              onMouseEnter={() => setHover(score)}
              onMouseLeave={() => setHover(0)}
              className={`text-2xl transition-all duration-100 ${
                active === score
                  ? 'scale-125 opacity-100'
                  : active && active !== score
                  ? 'opacity-30 scale-90'
                  : 'opacity-60 hover:opacity-100'
              }`}
              title={LABELS[i]}
            >
              {emoji}
            </button>
          )
        })}
      </div>
      {active > 0 && (
        <p className="text-xs text-center text-[#5B6B7C]">{LABELS[active - 1]}</p>
      )}
      {selected > 0 && (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Comentario opcional..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-[#F4F7FB] border border-[#E6EBF2] text-[#0B2545] placeholder-[#5B6B7C] focus:outline-none focus:border-[#1789FC] text-sm resize-none"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-2 rounded-lg bg-[#1789FC] hover:bg-[#0B72D6] disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {submitting ? 'Enviando...' : 'Enviar calificación'}
          </button>
        </div>
      )}
    </div>
  )
}
