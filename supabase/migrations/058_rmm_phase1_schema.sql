-- 058: RMM Fase 1 — esquema base (tablas, triggers, RLS, rate limit)
--
-- Modulo Remote Monitoring & Management. TODO ADITIVO: no altera datos
-- existentes (solo agrega columnas nulables/con default y tablas nuevas).
--
-- La entidad "cliente" es organizations (organization_id), consistente con
-- tickets y con get_my_org()/get_my_role(). NO se crea una tabla clients.
--
-- Modelo de auth del agente: el agente NO usa RLS (no tiene JWT). Habla solo
-- con /api/rmm/*, que valida su token (hash SHA-256), deriva el endpoint_id del
-- token y escribe con service_role acotado a ESE endpoint. La RLS de abajo
-- gobierna el OTRO camino: lecturas desde el navegador (admin/agente ven todo;
-- un cliente solo su propia organizacion).

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Toggle por cliente
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS rmm_enabled boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) endpoints
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.endpoints (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  hostname        text,
  os              text CHECK (os IN ('windows','linux')),
  agent_version   text,
  token_hash      text NOT NULL UNIQUE,
  token_prefix    text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','online','offline','disabled')),
  last_seen_at    timestamptz,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  disabled_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_endpoints_org        ON public.endpoints(organization_id);
CREATE INDEX IF NOT EXISTS idx_endpoints_token_hash ON public.endpoints(token_hash);

-- Vinculo ticket -> equipo de origen (para el panel de metricas en el detalle).
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS source_endpoint_id uuid REFERENCES public.endpoints(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) endpoint_metrics (alto volumen -> id bigint, no uuid). TTL 90 dias en 059.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.endpoint_metrics (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint_id    uuid NOT NULL REFERENCES public.endpoints(id) ON DELETE CASCADE,
  cpu_pct        numeric(5,2),
  ram_pct        numeric(5,2),
  disk_free_pct  numeric(5,2),
  uptime_seconds bigint,
  recorded_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_metrics_endpoint_time ON public.endpoint_metrics(endpoint_id, recorded_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 4) endpoint_inventory
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.endpoint_inventory (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id    uuid NOT NULL REFERENCES public.endpoints(id) ON DELETE CASCADE,
  os_version     text,
  installed_apps jsonb,
  hotfixes       jsonb,
  captured_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_endpoint_time ON public.endpoint_inventory(endpoint_id, captured_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 5) endpoint_commands
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.endpoint_commands (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id  uuid NOT NULL REFERENCES public.endpoints(id) ON DELETE CASCADE,
  command_type text NOT NULL,                       -- validado contra catalogo cerrado en la API
  payload      jsonb,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','expired')),
  result       jsonb,                               -- { stdout, stderr, exit_code }
  requested_by uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  picked_at    timestamptz,                         -- cuando el agente lo tomo
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_commands_endpoint_status ON public.endpoint_commands(endpoint_id, status);

-- ─────────────────────────────────────────────────────────────────────────
-- 6) endpoint_alert_rules
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.endpoint_alert_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric          text NOT NULL CHECK (metric IN ('cpu_pct','ram_pct','disk_free_pct','offline')),
  operator        text NOT NULL CHECK (operator IN ('>','>=','<','<=')),
  threshold       numeric NOT NULL,   -- para 'offline' el threshold se interpreta en MINUTOS (ver cron)
  severity        text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  action          text NOT NULL DEFAULT 'create_ticket' CHECK (action IN ('create_ticket','notify')),
  cooldown_minutes int NOT NULL DEFAULT 60,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON public.endpoint_alert_rules(organization_id) WHERE is_active;

-- ─────────────────────────────────────────────────────────────────────────
-- 7) endpoint_alert_state — anti-duplicado (un ticket por condicion, no uno
--    cada 5 min). Misma idea que sla_alert_sent_at.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.endpoint_alert_state (
  endpoint_id       uuid NOT NULL REFERENCES public.endpoints(id) ON DELETE CASCADE,
  rule_id           uuid NOT NULL REFERENCES public.endpoint_alert_rules(id) ON DELETE CASCADE,
  last_triggered_at timestamptz,
  active_ticket_id  uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  PRIMARY KEY (endpoint_id, rule_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- 8) rmm_rate_limits — serverless-safe (patron de auth_login_attempts).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rmm_rate_limits (
  endpoint_id   uuid NOT NULL REFERENCES public.endpoints(id) ON DELETE CASCADE,
  route         text NOT NULL,
  window_start  timestamptz NOT NULL DEFAULT now(),
  request_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (endpoint_id, route)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Triggers de integridad
-- ─────────────────────────────────────────────────────────────────────────

-- organization_id INMUTABLE: un endpoint nunca se reasigna a otro cliente.
CREATE OR REPLACE FUNCTION public.endpoints_lock_org()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'No se puede cambiar organization_id de un endpoint (%).', OLD.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_endpoints_lock_org ON public.endpoints;
CREATE TRIGGER trg_endpoints_lock_org BEFORE UPDATE ON public.endpoints
  FOR EACH ROW EXECUTE FUNCTION public.endpoints_lock_org();

-- Alta bloqueada si la organizacion no tiene rmm_enabled (defensa a nivel BD,
-- aunque el admin lo intente por error saltandose la API).
CREATE OR REPLACE FUNCTION public.endpoints_require_rmm()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o WHERE o.id = NEW.organization_id AND o.rmm_enabled
  ) THEN
    RAISE EXCEPTION 'RMM no esta activo para la organizacion %.', NEW.organization_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_endpoints_require_rmm ON public.endpoints;
CREATE TRIGGER trg_endpoints_require_rmm BEFORE INSERT ON public.endpoints
  FOR EACH ROW EXECUTE FUNCTION public.endpoints_require_rmm();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — camino admin/cliente (JWT). El agente escribe por API con service_role.
-- Escrituras: SIN politicas para anon/authenticated => deny. service_role salta RLS.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.endpoints           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endpoint_metrics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endpoint_inventory  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endpoint_commands   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endpoint_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endpoint_alert_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rmm_rate_limits     ENABLE ROW LEVEL SECURITY;

-- Quitar cualquier grant por defecto y dar SELECT (la RLS filtra las filas).
-- rmm_rate_limits queda solo-service (ni SELECT para authenticated).
REVOKE ALL ON public.endpoints, public.endpoint_metrics, public.endpoint_inventory,
              public.endpoint_commands, public.endpoint_alert_rules,
              public.endpoint_alert_state, public.rmm_rate_limits
  FROM anon, authenticated;
GRANT SELECT ON public.endpoints, public.endpoint_metrics, public.endpoint_inventory,
                public.endpoint_commands, public.endpoint_alert_rules,
                public.endpoint_alert_state
  TO authenticated;

-- endpoints: admin/agente ven todo; un cliente solo su organizacion.
CREATE POLICY endpoints_select ON public.endpoints FOR SELECT USING (
  (SELECT public.get_my_role()) IN ('admin','agent')
  OR organization_id = (SELECT public.get_my_org())
);

-- Tablas hijas: pertenencia via endpoint (la subconsulta ya pasa por la RLS de
-- endpoints, asi que un cliente solo alcanza los suyos).
CREATE POLICY metrics_select ON public.endpoint_metrics FOR SELECT USING (
  (SELECT public.get_my_role()) IN ('admin','agent')
  OR endpoint_id IN (SELECT id FROM public.endpoints WHERE organization_id = (SELECT public.get_my_org()))
);
CREATE POLICY inventory_select ON public.endpoint_inventory FOR SELECT USING (
  (SELECT public.get_my_role()) IN ('admin','agent')
  OR endpoint_id IN (SELECT id FROM public.endpoints WHERE organization_id = (SELECT public.get_my_org()))
);
CREATE POLICY commands_select ON public.endpoint_commands FOR SELECT USING (
  (SELECT public.get_my_role()) IN ('admin','agent')
  OR endpoint_id IN (SELECT id FROM public.endpoints WHERE organization_id = (SELECT public.get_my_org()))
);
CREATE POLICY alert_rules_select ON public.endpoint_alert_rules FOR SELECT USING (
  (SELECT public.get_my_role()) IN ('admin','agent')
  OR organization_id = (SELECT public.get_my_org())
);
CREATE POLICY alert_state_select ON public.endpoint_alert_state FOR SELECT USING (
  (SELECT public.get_my_role()) IN ('admin','agent')
  OR endpoint_id IN (SELECT id FROM public.endpoints WHERE organization_id = (SELECT public.get_my_org()))
);

COMMENT ON COLUMN public.endpoints.organization_id IS 'Cliente dueno del endpoint. Inmutable (trigger). Nunca se reasigna.';
COMMENT ON COLUMN public.endpoint_alert_rules.threshold IS 'Umbral. Para metric=offline se interpreta en MINUTOS contra now()-last_seen_at.';
