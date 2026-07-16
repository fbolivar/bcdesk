import { createServiceClient } from '@/lib/supabase/service'

/** Guarda (crea o reemplaza) el hash de contraseña de un usuario.
 *  El hash vive en user_credentials: tabla sin acceso para anon/authenticated,
 *  solo alcanzable por el servidor (service_role) o funciones SECURITY DEFINER.
 *  Nunca guardar hashes en profiles: esa tabla la leen los usuarios. */
export async function setPasswordHash(userId: string, passwordHash: string) {
  const admin = createServiceClient()
  return admin.from('user_credentials').upsert(
    { user_id: userId, password_hash: passwordHash, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
}
