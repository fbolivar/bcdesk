-- ============================================================
-- 027 · Revocación de sesión (token_version)
-- ============================================================
-- Permite invalidar sesiones activas (cambio/reset de contraseña, logout forzado).
-- El JWT lleva el claim `tv`; el servidor lo compara contra profiles.token_version
-- en getCurrentUser() y en los layouts. Al incrementar token_version, todos los
-- tokens con el `tv` anterior dejan de ser aceptados.
--
-- SEGURO / ADITIVO: aplicable en cualquier momento (no rompe el código actual).
-- Se preservan los GRANT existentes de auth_get_user_by_email (anon sigue hasta
-- que la 019 lo revoque post-deploy).
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

-- Recrear auth_get_user_by_email devolviendo token_version (cambio de firma → DROP+CREATE).
DROP FUNCTION IF EXISTS public.auth_get_user_by_email(text);
CREATE FUNCTION public.auth_get_user_by_email(p_email text)
 RETURNS TABLE(id uuid, email text, full_name text, role text, organization_id uuid,
               password_hash text, is_active boolean, token_version integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.email, p.full_name, p.role, p.organization_id, p.password_hash, p.is_active, p.token_version
  FROM profiles p
  WHERE lower(p.email) = lower(p_email)
  LIMIT 1;
$function$;
-- Estado de grants igual al actual (la 019 revocará anon/authenticated post-deploy).
GRANT EXECUTE ON FUNCTION public.auth_get_user_by_email(text) TO service_role, anon, authenticated;

-- Incrementar token_version (invalida sesiones). Solo service_role.
CREATE OR REPLACE FUNCTION public.bump_token_version(p_user uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE profiles SET token_version = token_version + 1 WHERE id = p_user RETURNING token_version;
$function$;
REVOKE EXECUTE ON FUNCTION public.bump_token_version(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_token_version(uuid) TO service_role;
