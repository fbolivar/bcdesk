import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password', () => {
  it('el hash verifica la contraseña correcta', async () => {
    const hash = await hashPassword('S3cret!clave')
    expect(hash).not.toBe('S3cret!clave') // no en claro
    expect(await verifyPassword('S3cret!clave', hash)).toBe(true)
  })

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('correcta')
    expect(await verifyPassword('incorrecta', hash)).toBe(false)
  })

  it('rechaza cuando el hash está vacío/ausente', async () => {
    expect(await verifyPassword('lo-que-sea', '')).toBe(false)
  })

  it('dos hashes de la misma clave son distintos (salt aleatorio)', async () => {
    const a = await hashPassword('misma')
    const b = await hashPassword('misma')
    expect(a).not.toBe(b)
    expect(await verifyPassword('misma', a)).toBe(true)
    expect(await verifyPassword('misma', b)).toBe(true)
  })
})
