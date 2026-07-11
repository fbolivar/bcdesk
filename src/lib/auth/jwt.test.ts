import { describe, it, expect, beforeAll } from 'vitest'

// El secreto se lee de forma perezosa dentro de cada función, así que basta
// con fijarlo antes de invocarlas.
beforeAll(() => { process.env.SUPABASE_JWT_SECRET = 'test-secret-para-jwt-1234567890' })

import { signSession, verifyToken, userFromPayload, type AppUser } from './jwt'
import { SignJWT } from 'jose'

const user: AppUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'test@x.co',
  full_name: 'Test User',
  role: 'admin',
  organization_id: '22222222-2222-2222-2222-222222222222',
  token_version: 3,
}

describe('jwt', () => {
  it('firma y verifica (round-trip) con las claims esperadas', async () => {
    const token = await signSession(user)
    const payload = await verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe(user.id)
    expect(payload!.role).toBe('authenticated') // rol de Postgres
    expect(payload!.user_role).toBe('admin')
    expect(payload!.tv).toBe(3)
    expect(payload!.org).toBe(user.organization_id)
  })

  it('userFromPayload mapea el AppUser', async () => {
    const token = await signSession(user)
    const payload = await verifyToken(token)
    const u = userFromPayload(payload!)
    expect(u).toEqual(user)
  })

  it('un token basura no verifica', async () => {
    expect(await verifyToken('esto.no.es-un-jwt')).toBeNull()
  })

  it('un token manipulado no verifica', async () => {
    const token = await signSession(user)
    const [h, p, s] = token.split('.')
    const tampered = `${h}.${p.slice(0, -2)}XY.${s}`
    expect(await verifyToken(tampered)).toBeNull()
  })

  it('un token expirado no verifica', async () => {
    const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
    const expired = await new SignJWT({ role: 'authenticated', tv: 1 })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer('supabase').setAudience('authenticated').setSubject(user.id)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secret)
    expect(await verifyToken(expired)).toBeNull()
  })

  it('un token firmado con otro secreto no verifica', async () => {
    const other = new TextEncoder().encode('secreto-distinto-987654321')
    const forged = await new SignJWT({ role: 'authenticated', tv: 1 })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer('supabase').setAudience('authenticated').setSubject(user.id)
      .setIssuedAt().setExpirationTime('1h').sign(other)
    expect(await verifyToken(forged)).toBeNull()
  })
})
