-- ============================================================
-- 025 · Consolidar/deduplicar políticas permisivas de rol mixto (2ª tanda)
-- ============================================================
-- Continúa la 024 sobre las tablas con rol mixto ({public}+{authenticated}).
-- Se preserva la semántica EXACTA:
--   · Duplicados legacy → se elimina el redundante (cero cambio).
--   · Lecturas `true` se mantienen en {authenticated} (no se filtra a anon).
--   · Escritura conserva el rol/predicado del FOR ALL original.
-- staff = (select public.get_my_role()) in ('admin','agent)  ≡ lookup inline previo.
-- Se deja `ticket_attachments` intacta (multi-política org-scoped compleja).
-- ============================================================

-- ---- Duplicados puros (drop del redundante) ----
-- push_subscriptions: 3 políticas ALL → dejar solo la del dueño. service_role
-- salta RLS de todos modos, así que su política es inútil.
DROP POLICY IF EXISTS "Users manage own push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "service_role_all" ON public.push_subscriptions;

-- org_api_tokens: dos ALL idénticas (admin). Conservar la de {authenticated} (con CHECK).
DROP POLICY IF EXISTS "admin_all_tokens" ON public.org_api_tokens;

-- audit_log: pares duplicados; conservar los {public} (audit_log_insert es superset).
DROP POLICY IF EXISTS "team_insert_audit" ON public.audit_log;
DROP POLICY IF EXISTS "team_read_audit" ON public.audit_log;

-- ---- kb_articles: quitar duplicados {authenticated} y consolidar (uniforme {public}) ----
DROP POLICY IF EXISTS "admins_all_kb" ON public.kb_articles;   -- dup de kb_team
DROP POLICY IF EXISTS "public_read_kb" ON public.kb_articles;  -- dup de kb_public
DROP POLICY IF EXISTS "kb_team" ON public.kb_articles;
DROP POLICY IF EXISTS "kb_public" ON public.kb_articles;
CREATE POLICY "kb_articles_sel" ON public.kb_articles FOR SELECT TO public
  USING (((select public.get_my_role()) in ('admin','agent')) OR (is_published = true));
CREATE POLICY "kb_articles_ins" ON public.kb_articles FOR INSERT TO public
  WITH CHECK ((select public.get_my_role()) in ('admin','agent'));
CREATE POLICY "kb_articles_upd" ON public.kb_articles FOR UPDATE TO public
  USING ((select public.get_my_role()) in ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) in ('admin','agent'));
CREATE POLICY "kb_articles_del" ON public.kb_articles FOR DELETE TO public
  USING ((select public.get_my_role()) in ('admin','agent'));

-- ---- major_incidents: lectura pública-a-autenticados (true), escritura staff ----
DROP POLICY IF EXISTS "Staff manage major_incidents" ON public.major_incidents;
DROP POLICY IF EXISTS "Anyone reads active major incidents" ON public.major_incidents;
CREATE POLICY "major_incidents_sel" ON public.major_incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "major_incidents_ins" ON public.major_incidents FOR INSERT TO public
  WITH CHECK ((select public.get_my_role()) in ('admin','agent'));
CREATE POLICY "major_incidents_upd" ON public.major_incidents FOR UPDATE TO public
  USING ((select public.get_my_role()) in ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) in ('admin','agent'));
CREATE POLICY "major_incidents_del" ON public.major_incidents FOR DELETE TO public
  USING ((select public.get_my_role()) in ('admin','agent'));

-- ---- major_incident_updates: igual patrón ----
DROP POLICY IF EXISTS "Staff manage mim_updates" ON public.major_incident_updates;
DROP POLICY IF EXISTS "Anyone reads mim_updates" ON public.major_incident_updates;
CREATE POLICY "mim_updates_sel" ON public.major_incident_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "mim_updates_ins" ON public.major_incident_updates FOR INSERT TO public
  WITH CHECK ((select public.get_my_role()) in ('admin','agent'));
CREATE POLICY "mim_updates_upd" ON public.major_incident_updates FOR UPDATE TO public
  USING ((select public.get_my_role()) in ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) in ('admin','agent'));
CREATE POLICY "mim_updates_del" ON public.major_incident_updates FOR DELETE TO public
  USING ((select public.get_my_role()) in ('admin','agent'));

-- ---- org_branding: lectura autenticada (true), gestión admin ----
DROP POLICY IF EXISTS "Admins manage org_branding" ON public.org_branding;
DROP POLICY IF EXISTS "Org members read their branding" ON public.org_branding;
CREATE POLICY "org_branding_sel" ON public.org_branding FOR SELECT TO authenticated USING (true);
CREATE POLICY "org_branding_ins" ON public.org_branding FOR INSERT TO public
  WITH CHECK ((select public.get_my_role()) = 'admin');
CREATE POLICY "org_branding_upd" ON public.org_branding FOR UPDATE TO public
  USING ((select public.get_my_role()) = 'admin')
  WITH CHECK ((select public.get_my_role()) = 'admin');
CREATE POLICY "org_branding_del" ON public.org_branding FOR DELETE TO public
  USING ((select public.get_my_role()) = 'admin');

-- ---- service_catalog_items: lectura autenticada (true), gestión admin ----
DROP POLICY IF EXISTS "Admins manage catalog" ON public.service_catalog_items;
DROP POLICY IF EXISTS "Authenticated read catalog" ON public.service_catalog_items;
CREATE POLICY "service_catalog_sel" ON public.service_catalog_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_catalog_ins" ON public.service_catalog_items FOR INSERT TO public
  WITH CHECK ((select public.get_my_role()) = 'admin');
CREATE POLICY "service_catalog_upd" ON public.service_catalog_items FOR UPDATE TO public
  USING ((select public.get_my_role()) = 'admin')
  WITH CHECK ((select public.get_my_role()) = 'admin');
CREATE POLICY "service_catalog_del" ON public.service_catalog_items FOR DELETE TO public
  USING ((select public.get_my_role()) = 'admin');

-- ---- project_tasks: staff gestiona; cliente lee tareas de proyectos de su org ----
DROP POLICY IF EXISTS "team_all_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "client_read_tasks" ON public.project_tasks;
CREATE POLICY "project_tasks_sel" ON public.project_tasks FOR SELECT TO authenticated
  USING (
    ((select public.get_my_role()) in ('admin','agent'))
    OR (project_id IN (
      SELECT p.id FROM projects p
      JOIN profiles pr ON pr.id = (select auth.uid())
      WHERE p.organization_id = pr.organization_id))
  );
CREATE POLICY "project_tasks_ins" ON public.project_tasks FOR INSERT TO public
  WITH CHECK ((select public.get_my_role()) in ('admin','agent'));
CREATE POLICY "project_tasks_upd" ON public.project_tasks FOR UPDATE TO public
  USING ((select public.get_my_role()) in ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) in ('admin','agent'));
CREATE POLICY "project_tasks_del" ON public.project_tasks FOR DELETE TO public
  USING ((select public.get_my_role()) in ('admin','agent'));
