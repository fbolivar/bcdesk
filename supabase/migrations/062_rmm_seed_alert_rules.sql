-- 062: reglas de alerta base para RMM.
--
-- 1) Función seed_rmm_alert_rules(org): inserta el set base SI la org no tiene
--    reglas (idempotente, no duplica). Las reglas quedan editables desde la UI.
-- 2) Trigger en organizations: al activar rmm_enabled (false->true, o INSERT con
--    true), auto-siembra el set base. Cubre cualquier vía (API o SQL directo).
-- 3) Siembra las organizaciones que YA tienen rmm_enabled=true.

CREATE OR REPLACE FUNCTION public.seed_rmm_alert_rules(p_org uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.endpoint_alert_rules WHERE organization_id = p_org) THEN
    RETURN; -- ya tiene reglas: no duplicar (respeta ediciones/borrados del admin)
  END IF;
  INSERT INTO public.endpoint_alert_rules
    (organization_id, metric, operator, threshold, severity, action, cooldown_minutes) VALUES
    (p_org, 'cpu_pct',        '>', 85, 'medium',   'create_ticket', 60),
    (p_org, 'cpu_pct',        '>', 95, 'high',     'create_ticket', 30),
    (p_org, 'ram_pct',        '>', 85, 'medium',   'create_ticket', 60),
    (p_org, 'ram_pct',        '>', 95, 'high',     'create_ticket', 30),
    (p_org, 'disk_free_pct',  '<', 15, 'medium',   'create_ticket', 240),
    (p_org, 'disk_free_pct',  '<',  5, 'critical', 'create_ticket', 60),
    (p_org, 'offline',        '>', 15, 'medium',   'create_ticket', 60),
    (p_org, 'offline',        '>', 60, 'high',     'create_ticket', 60);
END $$;

CREATE OR REPLACE FUNCTION public.trg_seed_rmm_on_enable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rmm_enabled AND (TG_OP = 'INSERT' OR NOT OLD.rmm_enabled) THEN
    PERFORM public.seed_rmm_alert_rules(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_organizations_seed_rmm ON public.organizations;
CREATE TRIGGER trg_organizations_seed_rmm
  AFTER INSERT OR UPDATE OF rmm_enabled ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_rmm_on_enable();

-- Siembra las orgs ya activas.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.organizations WHERE rmm_enabled LOOP
    PERFORM public.seed_rmm_alert_rules(r.id);
  END LOOP;
END $$;
