-- ============================================================
-- 019 · Revocar acceso público a las funciones de autenticación
-- ============================================================
-- HALLAZGO CRÍTICO (get_advisors + prueba empírica):
-- `auth_get_user_by_email` devuelve el password_hash y tenía GRANT a `anon`.
-- Con la anon key (pública) cualquiera podía volcar los hashes de todas las
-- cuentas por email → enumeración + crackeo offline. VERIFICADO explotable.
--
-- La app ya NO llama estas RPC como anon: auth.service.ts usa el service_role.
--
-- ⚠️ ORDEN: aplicar DESPUÉS de desplegar el código nuevo (createServiceClient).
-- Si se aplica antes, el login del deploy viejo (que llama como anon) se rompe
-- hasta el redeploy.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.auth_get_user_by_email(text)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_register_user(text, text, text)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_complete_invite(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_get_invitation(text)              FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.auth_get_user_by_email(text)            TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_register_user(text, text, text)    TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_complete_invite(text, text, text)  TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_get_invitation(text)               TO service_role;
