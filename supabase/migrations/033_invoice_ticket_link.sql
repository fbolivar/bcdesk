-- ============================================================
-- 033 · Vincular cuenta de cobro (invoice) con el ticket/servicio
-- ============================================================
-- Permite generar una factura "por servicio" ligada al ticket atendido,
-- para trazabilidad bidireccional (ticket ↔ cuenta de cobro).
-- ============================================================

alter table public.invoices
  add column if not exists ticket_id uuid references public.tickets(id) on delete set null;

create index if not exists idx_invoices_ticket_id on public.invoices(ticket_id);
