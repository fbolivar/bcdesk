-- ============================================================
-- 032 · Branding de correo desde UI + auto-cierre de resueltos
-- ============================================================

-- 1) Campos de branding específicos para los correos (editables desde la UI).
alter table public.org_branding
  add column if not exists email_tagline text,
  add column if not exists email_website text;

-- 2) Auto-cierre: cada hora cierra los tickets en estado 'resolved' sin
--    actividad por más de 3 días (si el cliente responde, el webhook los
--    reabre a 'open', reiniciando el conteo).
create or replace function public.run_auto_close_resolved()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  with closed as (
    update public.tickets
      set status = 'closed', updated_at = now()
      where status = 'resolved'
        and coalesce(resolved_at, updated_at) < now() - interval '3 days'
      returning id
  ),
  audit as (
    insert into public.audit_log (entity_type, entity_id, action, actor_id, new_values)
    select 'ticket', id, 'auto_closed', null,
           jsonb_build_object('status', 'closed', 'reason', 'Cerrado automáticamente por inactividad (3 días en resuelto)')
    from closed
    returning 1
  )
  select count(*) into n from closed;
  return n;
end $$;

select cron.schedule('auto-close-resolved', '7 * * * *', 'select public.run_auto_close_resolved()');
