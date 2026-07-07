-- ============================================================
-- 023 · Eliminar índices duplicados (get_advisors: duplicate_index)
-- ============================================================
-- La 022 creó 14 índices FK que resultaron idénticos a otros ya existentes
-- (la heurística de cobertura no los detectó por diferencias de forma).
-- Se eliminan los que creó la 022; se conservan los preexistentes.
-- ============================================================

DROP INDEX IF EXISTS public.idx_agent_skills_agent_id;
DROP INDEX IF EXISTS public.idx_audit_logs_actor_id;
DROP INDEX IF EXISTS public.idx_forum_posts_author_id;
DROP INDEX IF EXISTS public.idx_forum_posts_organization_id;
DROP INDEX IF EXISTS public.idx_forum_replies_post_id;
DROP INDEX IF EXISTS public.idx_invoices_organization_id;
DROP INDEX IF EXISTS public.idx_password_reset_tokens_user_id;
DROP INDEX IF EXISTS public.idx_project_comments_project_id;
DROP INDEX IF EXISTS public.idx_push_subscriptions_user_id;
DROP INDEX IF EXISTS public.idx_technical_visit_attachments_visit_id;
DROP INDEX IF EXISTS public.idx_technical_visits_organization_id;
DROP INDEX IF EXISTS public.idx_ticket_comments_ticket_id;
DROP INDEX IF EXISTS public.idx_tickets_assigned_to;
DROP INDEX IF EXISTS public.idx_tickets_organization_id;
