import { Globe } from 'lucide-react'
import { LanguageSelector } from '@/shared/components/language-selector'

export default function ClientLanguagePage() {
  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(0, 212, 170,0.15)' }}
        >
          <Globe size={20} color="#00D4AA" />
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#0B2545' }}>
            Idioma / Language
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#5B6B7C' }}>
            Selecciona el idioma de la interfaz · Select interface language
          </p>
        </div>
      </div>

      {/* Selector */}
      <div
        className="rounded-2xl p-5"
        style={{ background: '#FFFFFF', border: '1px solid #E6EBF2' }}
      >
        <LanguageSelector />
      </div>

      <p className="text-xs text-center mt-5" style={{ color: '#CBD5E1' }}>
        El cambio se aplica de inmediato · Changes apply immediately
      </p>
    </div>
  )
}
