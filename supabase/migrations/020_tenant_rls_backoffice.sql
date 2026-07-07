-- ============================================================
-- 020 · Cerrar políticas RLS permisivas (get_advisors: rls_policy_always_true)
-- ============================================================
-- Varias tablas tenían `USING(true)/WITH CHECK(true)` para cualquier
-- `authenticated` → un usuario CLIENTE podía leer/escribir datos internos de
-- back-office (proveedores, contratos, presupuesto IT, roles, configs, etc.).
--
-- Verificado en el código: NINGUNA página de cliente/pública lee estas tablas,
-- salvo dos excepciones que se preservan:
--   · maintenance_windows → la página pública /status la lee (SELECT público).
--   · kb_article_ratings   → el cliente valora artículos KB (solo su propia fila).
--
-- Predicado de staff: (select public.get_my_role()) in ('admin','agent')
-- auth.uid()/get_my_role() envueltos en (select …) para el plan RLS (perf).
-- ============================================================

-- ---- Back-office: solo staff (admin/agent) ----
DROP POLICY IF EXISTS "auth_vendors" ON public.vendors;
CREATE POLICY "vendors_staff" ON public.vendors FOR ALL TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));

DROP POLICY IF EXISTS "auth_vendor_contracts" ON public.vendor_contracts;
CREATE POLICY "vendor_contracts_staff" ON public.vendor_contracts FOR ALL TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));

DROP POLICY IF EXISTS "auth_it_budget" ON public.it_budget_items;
CREATE POLICY "it_budget_staff" ON public.it_budget_items FOR ALL TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));

DROP POLICY IF EXISTS "auth_custom_roles" ON public.custom_roles;
CREATE POLICY "custom_roles_staff" ON public.custom_roles FOR ALL TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));

DROP POLICY IF EXISTS "auth_remote_support" ON public.remote_support_configs;
CREATE POLICY "remote_support_staff" ON public.remote_support_configs FOR ALL TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));

DROP POLICY IF EXISTS "auth_sw_usage" ON public.software_usage_logs;
CREATE POLICY "sw_usage_staff" ON public.software_usage_logs FOR ALL TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));

DROP POLICY IF EXISTS "auth_volume_snapshots" ON public.ticket_volume_snapshots;
CREATE POLICY "volume_snapshots_staff" ON public.ticket_volume_snapshots FOR ALL TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));

DROP POLICY IF EXISTS "auth_multichannel" ON public.multichannel_messages;
CREATE POLICY "multichannel_staff" ON public.multichannel_messages FOR ALL TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));

DROP POLICY IF EXISTS "auth_business_hours" ON public.business_hours;
CREATE POLICY "business_hours_staff" ON public.business_hours FOR ALL TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));

-- ---- maintenance_windows: lectura pública (status board), escritura solo staff ----
DROP POLICY IF EXISTS "auth_maintenance" ON public.maintenance_windows;
CREATE POLICY "maintenance_read" ON public.maintenance_windows FOR SELECT USING (true);
CREATE POLICY "maintenance_staff_insert" ON public.maintenance_windows FOR INSERT TO authenticated
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));
CREATE POLICY "maintenance_staff_update" ON public.maintenance_windows FOR UPDATE TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));
CREATE POLICY "maintenance_staff_delete" ON public.maintenance_windows FOR DELETE TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'));

-- ---- kb_article_ratings: cada usuario gestiona su propia valoración; staff lee todo ----
DROP POLICY IF EXISTS "Authenticated users rate kb" ON public.kb_article_ratings;
CREATE POLICY "kb_ratings_own" ON public.kb_article_ratings FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "kb_ratings_staff_read" ON public.kb_article_ratings FOR SELECT TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'));

-- ---- audit_logs: solo staff lee; insertar únicamente como uno mismo (sin spoof) ----
DROP POLICY IF EXISTS "auth_audit_read" ON public.audit_logs;
DROP POLICY IF EXISTS "auth_audit_insert" ON public.audit_logs;
CREATE POLICY "audit_staff_read" ON public.audit_logs FOR SELECT TO authenticated
  USING ((select public.get_my_role()) IN ('admin','agent'));
CREATE POLICY "audit_self_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent') OR actor_id = (select auth.uid()));

-- ---- survey_responses: quitar el INSERT permisivo (ya existe uno scopeado por respondent) ----
DROP POLICY IF EXISTS "Anyone can insert survey_response" ON public.survey_responses;
