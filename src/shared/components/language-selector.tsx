'use client'

import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'

type Locale = 'es' | 'en'

const STORAGE_KEY = 'bcdesk_locale'

const LANGUAGES: { locale: Locale; label: string; sublabel: string; flag: string }[] = [
  { locale: 'es', label: 'Español', sublabel: 'Spanish', flag: '🇪🇸' },
  { locale: 'en', label: 'Inglés',  sublabel: 'English', flag: '🇺🇸' },
]

export function LanguageSelector() {
  const [active, setActive] = useState<Locale>('es')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'es' || stored === 'en') setActive(stored)
    setMounted(true)
  }, [])

  function handleSelect(locale: Locale) {
    localStorage.setItem(STORAGE_KEY, locale)
    setActive(locale)
    window.location.reload()
  }

  if (!mounted) return null

  return (
    <div className="flex flex-col gap-3">
      {LANGUAGES.map(({ locale, label, sublabel, flag }) => {
        const isActive = active === locale
        return (
          <button
            key={locale}
            onClick={() => handleSelect(locale)}
            className="flex items-center gap-4 px-5 py-4 rounded-xl text-left transition-all duration-150 border"
            style={{
              background: isActive ? 'rgba(79,138,255,0.12)' : 'rgba(30,41,59,0.6)',
              borderColor: isActive ? '#4F8AFF' : '#334155',
              boxShadow: isActive ? '0 0 0 1px #4F8AFF33' : 'none',
            }}
          >
            <span className="text-2xl">{flag}</span>
            <div className="flex-1">
              <p
                className="text-sm font-semibold"
                style={{ color: isActive ? '#4F8AFF' : '#F1F5F9' }}
              >
                {label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                {sublabel}
              </p>
            </div>
            {isActive && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(79,138,255,0.2)', color: '#4F8AFF' }}
              >
                Activo / Active
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Small badge shown in headers / nav to indicate current locale */
export function LocaleBadge() {
  const [locale, setLocale] = useState<Locale>('es')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'es' || stored === 'en') setLocale(stored)
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <a
      href={`/${locale === 'es' ? 'client' : 'client'}/settings/language`}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors"
      style={{ background: 'rgba(79,138,255,0.12)', color: '#4F8AFF' }}
      title="Cambiar idioma / Change language"
    >
      <Globe size={11} />
      <span>{locale.toUpperCase()}</span>
    </a>
  )
}
