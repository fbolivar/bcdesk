import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { Role } from '@/lib/supabase/types'
import { SESSION_MAX_AGE } from '@/lib/auth/constants'

/**
 * Lógica pura de JWT (solo jose, sin dependencias de servidor como next/headers),
 * de modo que se pueda usar tanto en el middleware (proxy) como en server actions.
 *
 * El token se firma con el JWT secret del proyecto Supabase (HS256) con
 * `sub = id del usuario` y `role = authenticated`, para que PostgREST lo valide
 * y `auth.uid()` resuelva → todas las políticas RLS existentes siguen funcionando.
 */

export interface AppUser {
  id: string
  email: string
  full_name: string
  role: Role
  organization_id: string | null
}

function getSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    throw new Error(
      'SUPABASE_JWT_SECRET no está configurado. Cópialo del dashboard de Supabase: Project Settings → API → JWT Secret.'
    )
  }
  return new TextEncoder().encode(secret)
}

export async function signSession(user: AppUser): Promise<string> {
  return new SignJWT({
    role: 'authenticated', // rol de Postgres para PostgREST/RLS
    email: user.email,
    user_role: user.role, // rol de la app (admin/agent/client), para el middleware
    org: user.organization_id,
    name: user.full_name,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('supabase')
    .setAudience('authenticated')
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { audience: 'authenticated' })
    return payload
  } catch {
    return null
  }
}

export function userFromPayload(payload: JWTPayload): AppUser | null {
  if (!payload.sub) return null
  return {
    id: payload.sub,
    email: (payload.email as string) ?? '',
    full_name: (payload.name as string) ?? '',
    role: (payload.user_role as Role) ?? 'client',
    organization_id: (payload.org as string | null) ?? null,
  }
}
