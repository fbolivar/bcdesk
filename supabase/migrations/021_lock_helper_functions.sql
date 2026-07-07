-- ============================================================
-- 021 · Revocar EXECUTE público de funciones internas (get_advisors)
-- ============================================================
-- SEGURO / NO BLOQUEANTE.
-- · Funciones de trigger: nunca deben llamarse por RPC. Los triggers se disparan
--   sin requerir EXECUTE del usuario, así que revocarlo no rompe nada.
-- · Upvotes: solo usuarios autenticados (foro); anon no.
-- Nota: get_my_role()/get_my_org() SÍ quedan ejecutables por authenticated
--   porque la RLS los invoca en el contexto del usuario (no se pueden revocar).
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.set_updated_at()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_chat_session_timestamp()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_change() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_upvotes(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decrement_upvotes(uuid) FROM PUBLIC, anon;
