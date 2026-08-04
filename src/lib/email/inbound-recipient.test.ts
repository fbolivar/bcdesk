import { describe, it, expect } from 'vitest'
import { isAddressedToSupport } from './inbound-recipient'

// Sin SUPPORT_EMAIL en el entorno de test, el helper usa el default
// 'soporte@fernandobolivar.app'.
describe('isAddressedToSupport', () => {
  it('acepta el buzón de soporte', () => {
    expect(isAddressedToSupport('soporte@fernandobolivar.app')).toBe(true)
    expect(isAddressedToSupport('Soporte HexDesk <soporte@fernandobolivar.app>')).toBe(true)
    expect(isAddressedToSupport('SOPORTE@FERNANDOBOLIVAR.APP')).toBe(true)
  })

  it('acepta los +alias de respuesta a un ticket', () => {
    expect(isAddressedToSupport('soporte+t0a1b2c3d4e5f60718293a4b5c6d7e8f9@fernandobolivar.app')).toBe(true)
  })

  it('acepta cuando soporte está entre varios destinatarios', () => {
    expect(isAddressedToSupport('otro@x.com, soporte@fernandobolivar.app')).toBe(true)
  })

  it('RECHAZA la dirección personal y otras del dominio', () => {
    expect(isAddressedToSupport('fbolivarb@fernandobolivar.app')).toBe(false)
    expect(isAddressedToSupport('Fernando <fbolivarb@fernandobolivar.app>')).toBe(false)
    expect(isAddressedToSupport('hola@fernandobolivar.app')).toBe(false)
    expect(isAddressedToSupport('cliente@otraempresa.com')).toBe(false)
  })

  it('sin campo `to` no descarta (para no perder correos)', () => {
    expect(isAddressedToSupport(undefined)).toBe(true)
    expect(isAddressedToSupport('')).toBe(true)
  })
})
