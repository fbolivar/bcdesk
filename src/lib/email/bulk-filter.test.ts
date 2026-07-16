import { describe, it, expect } from 'vitest'
import { isBulkMail, hasNoReplyLocalpart } from './bulk-filter'

describe('isBulkMail', () => {
  // Casos reales que llenaron la bandeja de ruido (Cloudflare, Google).
  it('filtra remitentes no-reply', () => {
    expect(isBulkMail('noreply@notify.cloudflare.com')).toBe(true)
    expect(isBulkMail('no-reply@google.com')).toBe(true)
    expect(isBulkMail('do-not-reply@accounts.google.com')).toBe(true)
    expect(isBulkMail('notifications@github.com')).toBe(true)
  })

  it('filtra correo masivo aunque el remitente parezca normal', () => {
    // El marketing suele venir de una direccion normal: la cabecera lo delata.
    expect(isBulkMail('cloudflare@e.cloudflare.com', { 'List-Unsubscribe': '<https://x/u>' })).toBe(true)
    expect(isBulkMail('news@empresa.com', { 'Precedence': 'bulk' })).toBe(true)
    expect(isBulkMail('sistema@x.com', { 'Auto-Submitted': 'auto-generated' })).toBe(true)
    expect(isBulkMail('lista@x.com', { 'List-Id': '<lista.x.com>' })).toBe(true)
  })

  it('las cabeceras se leen sin importar mayusculas/minusculas', () => {
    expect(isBulkMail('x@y.com', { 'list-unsubscribe': '<https://x/u>' })).toBe(true)
    expect(isBulkMail('x@y.com', { 'LIST-UNSUBSCRIBE': '<https://x/u>' })).toBe(true)
  })

  // Lo critico: no perder un correo real de un cliente.
  it('NO filtra a una persona real pidiendo soporte', () => {
    expect(isBulkMail('sistemas@biofix.com.co')).toBe(false)
    expect(isBulkMail('operaciones@bc-security.com')).toBe(false)
    expect(isBulkMail('juan.perez@empresa.com')).toBe(false)
    // info@ y soporte@ son buzones de negocio legitimos, no marketing.
    expect(isBulkMail('info@empresa.com')).toBe(false)
    expect(isBulkMail('soporte@cliente.com')).toBe(false)
  })

  it('sin cabeceras ni patron sospechoso, no filtra', () => {
    expect(isBulkMail('ana@cliente.com', undefined)).toBe(false)
    expect(isBulkMail('ana@cliente.com', null)).toBe(false)
    expect(isBulkMail('ana@cliente.com', {})).toBe(false)
  })

  it('una cabecera vacia no cuenta como masivo', () => {
    expect(isBulkMail('ana@cliente.com', { 'List-Unsubscribe': '' })).toBe(false)
    expect(isBulkMail('ana@cliente.com', { 'Precedence': 'normal' })).toBe(false)
  })
})

describe('hasNoReplyLocalpart', () => {
  it('solo mira la parte antes de la arroba', () => {
    expect(hasNoReplyLocalpart('noreply@x.com')).toBe(true)
    // El dominio contiene "noreply" pero el buzon es una persona: no filtrar.
    expect(hasNoReplyLocalpart('ana@noreply-corp.com')).toBe(false)
  })
})
