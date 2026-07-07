-- ============================================================
-- 018 · Fijar search_path en funciones SECURITY DEFINER
-- ============================================================
-- get_advisors: `function_search_path_mutable`. Una search_path mutable en
-- funciones SECURITY DEFINER permite search_path injection (el llamador podía
-- alterar la resolución de nombres). La fijamos a `public`.
--
-- SEGURO / NO BLOQUEANTE: no depende del despliegue del código. Aplicar cuando sea.
-- ============================================================

ALTER FUNCTION public.set_updated_at()                    SET search_path = public;
ALTER FUNCTION public.get_my_role()                       SET search_path = public;
ALTER FUNCTION public.get_my_org()                        SET search_path = public;
ALTER FUNCTION public.update_chat_session_timestamp()     SET search_path = public;
ALTER FUNCTION public.increment_upvotes(uuid)             SET search_path = public;
ALTER FUNCTION public.decrement_upvotes(uuid)             SET search_path = public;
ALTER FUNCTION public.prevent_profile_privilege_change()  SET search_path = public;
