-- ============================================================
-- 024 · Consolidar políticas permisivas (get_advisors: multiple_permissive_policies)
-- ============================================================
-- Patrón: `FOR ALL (staff)` que solapa con `FOR SELECT (lectura)` → Postgres
-- evalúa ambas en cada SELECT. Se fusiona en UNA política por comando:
--   SELECT      USING (qual_ALL OR qual_SELECT1 OR …)
--   INSERT      WITH CHECK (check_ALL)
--   UPDATE      USING (qual_ALL) WITH CHECK (check_ALL)
--   DELETE      USING (qual_ALL)
-- Es SEMÁNTICAMENTE IDÉNTICO (mismo OR de predicados, mismo rol) — solo elimina
-- el solapamiento. Solo se tocan tablas con ROL UNIFORME (todas {public}, o
-- {authenticated}); las de rol mixto ({public}+{authenticated}) se dejan intactas
-- porque fusionarlas cambiaría el alcance anon/authenticated.
--
-- El bloque lee los predicados vivos del catálogo (sin transcribir a mano) y es
-- transaccional (todo-o-nada).
-- ============================================================

do $$
declare
  t text;
  a_q text; a_c text;
  sel_using text;
  pol_role text;
  to_clause text;
  r record;
  tables text[] := array[
    'agent_badges','agent_skills','announcements','approval_workflows','assets',
    'contracts','custom_fields','escalation_rules','invoice_items','invoices',
    'project_phases','projects','routing_rules','saved_views','skills',
    'sla_policies','surveys','kb_article_ratings','survey_responses'
  ];
begin
  foreach t in array tables loop
    -- Política FOR ALL permisiva (si existe): sus predicados gobiernan escritura.
    select qual, with_check into a_q, a_c
    from pg_policies
    where schemaname='public' and tablename=t and cmd='ALL' and permissive='PERMISSIVE'
    limit 1;

    -- Rol uniforme de las políticas a fusionar (ALL + SELECT).
    select case when 'public' = any(roles) then 'public' else roles[1] end into pol_role
    from pg_policies
    where schemaname='public' and tablename=t and cmd in ('ALL','SELECT') and permissive='PERMISSIVE'
    limit 1;

    -- SELECT consolidado = OR de todos los quals de SELECT (+ el de ALL).
    select string_agg('('||qual||')', ' OR ') into sel_using
    from pg_policies
    where schemaname='public' and tablename=t and cmd='SELECT' and permissive='PERMISSIVE';

    if a_q is not null then
      sel_using := '('||a_q||') OR ('||coalesce(sel_using,'false')||')';
    end if;

    -- Cláusula TO: 'public' es palabra clave (sin comillas); otros roles como identificador.
    to_clause := case when pol_role = 'public' then 'public' else quote_ident(pol_role) end;

    -- Eliminar las políticas permisivas ALL + SELECT existentes.
    for r in
      select policyname from pg_policies
      where schemaname='public' and tablename=t and cmd in ('ALL','SELECT') and permissive='PERMISSIVE'
    loop
      execute format('DROP POLICY %I ON public.%I', r.policyname, t);
    end loop;

    -- Recrear: una SELECT (siempre) + INSERT/UPDATE/DELETE si había FOR ALL.
    if sel_using is not null then
      execute format('CREATE POLICY %I ON public.%I FOR SELECT TO %s USING (%s)', t||'_sel', t, to_clause, sel_using);
    end if;
    if a_q is not null then
      execute format('CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK (%s)', t||'_ins', t, to_clause, coalesce(a_c, a_q));
      execute format('CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING (%s) WITH CHECK (%s)', t||'_upd', t, to_clause, a_q, coalesce(a_c, a_q));
      execute format('CREATE POLICY %I ON public.%I FOR DELETE TO %s USING (%s)', t||'_del', t, to_clause, a_q);
    end if;
  end loop;
end $$;
