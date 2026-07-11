'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_STORAGE, isLocale, type Locale } from './config'
import { t as translate } from './translations'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

/** Persiste el idioma en cookie (server-readable) y localStorage (espejo). */
export function persistLocale(locale: Locale) {
  if (typeof document !== 'undefined') {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCALE_STORAGE, locale)
  }
}

/** Lee el locale activo del cliente (cookie → localStorage → default).
 *  Devuelve el default en el primer render para evitar hydration mismatch. */
export function useLocale(): Locale {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)
  useEffect(() => {
    const fromCookie = readCookie(LOCALE_COOKIE)
    const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_STORAGE) : null
    const resolved = [fromCookie, fromStorage].find(isLocale)
    if (resolved) setLocale(resolved)
  }, [])
  return locale
}

/** Hook de traducción por claves (messages/*.json). */
export function useT() {
  const locale = useLocale()
  return { locale, t: (key: string) => translate(key, locale) }
}
