-- ============================================================
-- 026 · Consolidar ticket_attachments (última multiple_permissive_policies)
-- ============================================================
-- Antes: team_all (ALL staff) + attachments_insert (INSERT self) +
--        client_insert (INSERT self+org) + attachments_select (SELECT staff|org) +
--        client_read_own (SELECT org).
-- Efectivo por comando (preservado EXACTO):
--   SELECT = staff OR (ticket en mi org)      [attachments_select ya lo cubre]
--   INSERT = (uploaded_by = yo) OR staff      [unión de los INSERT existentes]
--   UPDATE/DELETE = staff                     [de team_all]
-- ============================================================

DROP POLICY IF EXISTS "team_all_attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "attachments_insert" ON public.ticket_attachments;
DROP POLICY IF EXISTS "client_insert_attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "attachments_select" ON public.ticket_attachments;
DROP POLICY IF EXISTS "client_read_own_attachments" ON public.ticket_attachments;

CREATE POLICY "ticket_attachments_sel" ON public.ticket_attachments FOR SELECT TO public
  USING (
    ((select public.get_my_role()) in ('admin','agent'))
    OR (ticket_id IN (SELECT tickets.id FROM tickets
                      WHERE tickets.organization_id = (select public.get_my_org())))
  );

CREATE POLICY "ticket_attachments_ins" ON public.ticket_attachments FOR INSERT TO public
  WITH CHECK (
    (uploaded_by = (select auth.uid()))
    OR ((select public.get_my_role()) in ('admin','agent'))
  );

CREATE POLICY "ticket_attachments_upd" ON public.ticket_attachments FOR UPDATE TO public
  USING ((select public.get_my_role()) in ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) in ('admin','agent'));

CREATE POLICY "ticket_attachments_del" ON public.ticket_attachments FOR DELETE TO public
  USING ((select public.get_my_role()) in ('admin','agent'));
