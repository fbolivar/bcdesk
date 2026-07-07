-- ============================================================
-- 030 · Webhook saliente firmado en cambios de estado de ticket
-- ============================================================
-- En cada cambio de `status` de un ticket, HexDesk hace POST a la(s) URL(s)
-- configuradas en webhook_integrations (integration_type='webhook') de esa
-- organización, firmando el cuerpo con HMAC-SHA256 (header X-HexDesk-Signature).
-- Usa pg_net (HTTP async, no bloquea la transacción) + pgcrypto (hmac).
-- El secreto vive en webhook_integrations.config->>'secret'.
-- ============================================================

create extension if not exists pg_net;

create or replace function public.notify_ticket_status_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  wh record;
  payload jsonb;
  body_text text;
  sig text;
begin
  -- Solo en cambios reales de estado.
  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;

  payload := jsonb_build_object(
    'event', 'ticket.status_changed',
    'sent_at', now(),
    'ticket', jsonb_build_object(
      'id', NEW.id,
      'ticket_number', NEW.ticket_number,
      'status', NEW.status,
      'previous_status', OLD.status,
      'priority', NEW.priority,
      'category', NEW.category,
      'title', NEW.title,
      'external_ref', NEW.external_ref,
      'requester_email', NEW.requester_email,
      'resolved_at', NEW.resolved_at,
      'updated_at', NEW.updated_at
    )
  );
  body_text := payload::text;

  for wh in
    select webhook_url, config
    from public.webhook_integrations
    where organization_id = NEW.organization_id
      and is_active
      and integration_type = 'webhook'
      and webhook_url is not null
      and coalesce(config->>'secret', '') <> ''
      and (events is null or events = '{}' or 'ticket.status_changed' = any(events))
  loop
    sig := encode(hmac(body_text, wh.config->>'secret', 'sha256'), 'hex');
    perform net.http_post(
      url := wh.webhook_url,
      body := payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-HexDesk-Event', 'ticket.status_changed',
        'X-HexDesk-Signature', sig
      )
    );
  end loop;

  update public.webhook_integrations set last_triggered_at = now()
    where organization_id = NEW.organization_id and integration_type = 'webhook' and is_active;

  return NEW;
end $$;

drop trigger if exists trg_ticket_status_webhook on public.tickets;
create trigger trg_ticket_status_webhook
  after update of status on public.tickets
  for each row execute function public.notify_ticket_status_webhook();
