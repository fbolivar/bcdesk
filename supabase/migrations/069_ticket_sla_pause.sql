-- 069: Pausar el SLA de un ticket (el reloj de resolución no corre en pausa).
--
-- Modelo: sla_resolution_due_at es una fecha límite ABSOLUTA. Para pausar:
--  - Al PAUSAR se guarda sla_paused_at = now(). El cron de SLA salta los tickets
--    en pausa (no avisa ni marca incumplido).
--  - Al REANUDAR se EMPUJA el vencimiento hacia adelante por el tiempo pausado, y
--    se limpia sla_paused_at. Así el modelo de "due_at absoluto" sigue intacto.
-- Cubre respuesta y resolución (ambos relojes se detienen).

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS sla_paused_at timestamptz;

-- Pausar: marca la hora si el ticket está activo y no estaba ya en pausa.
CREATE OR REPLACE FUNCTION public.ticket_pause_sla(p_ticket uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.get_my_role() NOT IN ('admin','agent') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.tickets
     SET sla_paused_at = now()
   WHERE id = p_ticket
     AND sla_paused_at IS NULL
     AND status NOT IN ('resolved','closed','cancelled');

  INSERT INTO public.audit_logs(actor_id, resource_type, resource_id, action, new_values)
  VALUES (auth.uid(), 'ticket', p_ticket, 'sla_paused', '{}'::jsonb);
END;
$$;

-- Reanudar: empuja los vencimientos por el tiempo en pausa y limpia el flag.
CREATE OR REPLACE FUNCTION public.ticket_resume_sla(p_ticket uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.get_my_role() NOT IN ('admin','agent') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.tickets
     SET sla_resolution_due_at = sla_resolution_due_at + (now() - sla_paused_at),
         sla_response_due_at = CASE
           WHEN first_response_at IS NULL AND sla_response_due_at IS NOT NULL
           THEN sla_response_due_at + (now() - sla_paused_at)
           ELSE sla_response_due_at END,
         sla_paused_at = NULL
   WHERE id = p_ticket
     AND sla_paused_at IS NOT NULL;

  INSERT INTO public.audit_logs(actor_id, resource_type, resource_id, action, new_values)
  VALUES (auth.uid(), 'ticket', p_ticket, 'sla_resumed', '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_pause_sla(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ticket_resume_sla(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ticket_pause_sla(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ticket_resume_sla(uuid) TO authenticated, service_role;
