-- 045: Protege la columna profiles.password_hash a nivel de privilegio.
-- Antes, el rol authenticated podía leer password_hash vía PostgREST (un agente
-- el de todos; un cliente el del agente asignado). La app solo lee el hash con
-- el service client, así que login/registro/reset siguen funcionando.
-- Nota: al ser grant por columnas, columnas nuevas de profiles deberán añadirse
-- a este GRANT para que authenticated pueda leerlas.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, organization_id, role, full_name, email, phone, avatar_url, job_title,
  is_active, last_login_at, created_at, updated_at, custom_role_id, auth_source,
  external_id, directory_synced_at, token_version
) ON public.profiles TO anon, authenticated;
