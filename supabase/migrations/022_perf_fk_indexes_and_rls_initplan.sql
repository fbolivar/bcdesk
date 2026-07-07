-- ============================================================
-- 022 · Rendimiento: índices de FKs + RLS initplan (get_advisors)
-- ============================================================
-- SEGURO / NO BLOQUEANTE. Dos partes idempotentes basadas en el catálogo:
--   A) Índice para toda foreign key sin índice de cobertura (joins/cascadas).
--   B) Envolver auth.uid()/get_my_role()/get_my_org() en (select …) dentro de
--      las políticas RLS → se evalúan una vez por query (initplan), no por fila.
--      Se usa ALTER POLICY (cambia solo la expresión; preserva rol/cmd/nombre)
--      y centinelas para no doble-envolver lo ya envuelto (100% idempotente,
--      semánticamente idéntico).
-- ============================================================

-- ---- A) Índices para FKs sin cobertura ----
do $$
declare r record;
begin
  for r in
    with fks as (
      select con.oid, con.conrelid, rel.relname, con.conkey as cols
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where con.contype = 'f' and ns.nspname = 'public'
    ),
    covered as (
      select distinct f.oid
      from fks f
      join pg_index i on i.indrelid = f.conrelid
      where (i.indkey::int2[])[1:array_length(f.cols,1)] = f.cols::int2[]
    )
    select f.relname as tbl,
           (select string_agg(a.attname, '_' order by k.ord)
              from unnest(f.cols) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = f.conrelid and a.attnum = k.attnum) as col_us,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(f.cols) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = f.conrelid and a.attnum = k.attnum) as col_list
    from fks f
    where f.oid not in (select oid from covered)
  loop
    execute format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)',
                   left('idx_' || r.tbl || '_' || r.col_us, 63), r.tbl, r.col_list);
  end loop;
end $$;

-- ---- B) RLS initplan: envolver funciones en (select …) ----
create or replace function pg_temp.wrap_rls(e text) returns text language sql immutable as $f$
  select case when e is null then null else
    regexp_replace(
     regexp_replace(
      regexp_replace(
       regexp_replace(
        regexp_replace(
         regexp_replace(
          regexp_replace(
           regexp_replace(
            regexp_replace(
             regexp_replace(
              regexp_replace(
               regexp_replace(
                regexp_replace(
                 regexp_replace(e,
                  '\(select auth\.uid\(\)\)', '@@U@@', 'g'),
                  '\(select public\.get_my_role\(\)\)', '@@WR@@', 'g'),
                  '\(select public\.get_my_org\(\)\)', '@@WO@@', 'g'),
                  'public\.get_my_role\(\)', '@@R@@', 'g'),
                  'public\.get_my_org\(\)', '@@O@@', 'g'),
                  'get_my_role\(\)', '(select public.get_my_role())', 'g'),
                  'get_my_org\(\)', '(select public.get_my_org())', 'g'),
                  'auth\.uid\(\)', '(select auth.uid())', 'g'),
                  'auth\.role\(\)', '(select auth.role())', 'g'),
                  '@@R@@', '(select public.get_my_role())', 'g'),
                  '@@O@@', '(select public.get_my_org())', 'g'),
                  '@@U@@', '(select auth.uid())', 'g'),
                  '@@WR@@', '(select public.get_my_role())', 'g'),
                  '@@WO@@', '(select public.get_my_org())', 'g')
  end
$f$;

do $$
declare r record; nq text; nc text;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies where schemaname = 'public'
  loop
    nq := pg_temp.wrap_rls(r.qual);
    nc := pg_temp.wrap_rls(r.with_check);
    if nq is distinct from r.qual or nc is distinct from r.with_check then
      if r.qual is not null and r.with_check is not null then
        execute format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)', r.policyname, r.tablename, nq, nc);
      elsif r.qual is not null then
        execute format('ALTER POLICY %I ON public.%I USING (%s)', r.policyname, r.tablename, nq);
      elsif r.with_check is not null then
        execute format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.policyname, r.tablename, nc);
      end if;
    end if;
  end loop;
end $$;
