-- ============================================================
-- 031 · Escalamiento automático de SLA (pg_cron)
-- ============================================================
-- Cada 5 minutos, los tickets cuyo SLA de resolución vence en ≤30 min (o ya
-- venció) generan una notificación al agente asignado + admins/agentes activos,
-- y se marcan como escalados para no repetir el aviso. Si ya venció, marca
-- sla_breached. Corre 100% en la base (no depende del cron de Vercel).
-- ============================================================

create extension if not exists pg_cron;

alter table public.tickets
  add column if not exists sla_escalated boolean not null default false;

create or replace function public.run_sla_escalations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  -- Notifica a destinatarios (agente asignado + admins/agentes activos) por cada
  -- ticket en riesgo aún no escalado.
  with at_risk as (
    select id, ticket_number, title, sla_resolution_due_at, assigned_to
    from public.tickets
    where status not in ('resolved', 'closed', 'cancelled')
      and sla_resolution_due_at is not null
      and sla_escalated = false
      and sla_resolution_due_at <= now() + interval '30 minutes'
  ),
  recipients as (
    select ar.id as ticket_id, ar.ticket_number, ar.title, ar.sla_resolution_due_at,
           p.id as user_id, p.role
    from at_risk ar
    join public.profiles p
      on p.is_active and (p.id = ar.assigned_to or p.role in ('admin', 'agent'))
  ),
  ins as (
    insert into public.notifications (user_id, type, title, body, link)
    select r.user_id, 'sla',
      '⚠️ SLA por vencer #' || r.ticket_number,
      r.title || ' — vence ' || to_char(r.sla_resolution_due_at at time zone 'America/Bogota', 'HH24:MI'),
      '/' || (case when r.role = 'admin' then 'admin' else 'agent' end) || '/tickets/' || r.ticket_id
    from recipients r
    returning 1
  )
  select count(*) into n from ins;

  update public.tickets set sla_escalated = true
    where status not in ('resolved', 'closed', 'cancelled')
      and sla_resolution_due_at is not null
      and sla_escalated = false
      and sla_resolution_due_at <= now() + interval '30 minutes';

  update public.tickets set sla_breached = true
    where status not in ('resolved', 'closed', 'cancelled')
      and sla_resolution_due_at is not null
      and sla_resolution_due_at < now()
      and sla_breached = false;

  return n;
end $$;

-- Agenda cada 5 minutos (cron.schedule por nombre reemplaza si ya existe).
select cron.schedule('sla-escalations', '*/5 * * * *', 'select public.run_sla_escalations()');
