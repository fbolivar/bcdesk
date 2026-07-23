-- 061: paquetes de instalación del agente RMM (link de descarga de un solo uso).
--
-- Cada fila es un instalador generado para un endpoint: guarda el token del
-- endpoint EN PLANO temporalmente (para meterlo en el config.yaml del script) y
-- se borra al descargar. El download_token es el secreto de la URL pública.

CREATE TABLE IF NOT EXISTS public.rmm_installers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  download_token text NOT NULL UNIQUE,                    -- 256 bits hex, secreto de la URL
  endpoint_id    uuid NOT NULL REFERENCES public.endpoints(id) ON DELETE CASCADE,
  os             text NOT NULL CHECK (os IN ('windows','linux')),
  agent_token    text,                                    -- plano TEMPORAL; se borra al descargar/expirar
  expires_at     timestamptz NOT NULL,                    -- now() + 15 min
  used_at        timestamptz,                             -- primer (y único) uso
  created_by     uuid REFERENCES public.profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rmm_installers_endpoint ON public.rmm_installers(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_rmm_installers_token    ON public.rmm_installers(download_token);

-- Solo service_role. Ni anon ni authenticated: el POST admin y el GET público
-- pasan por API con service role (el GET valida el download_token, no la sesión).
ALTER TABLE public.rmm_installers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rmm_installers FROM anon, authenticated;

COMMENT ON COLUMN public.rmm_installers.agent_token IS 'Token del endpoint en plano. Temporal: se borra en el primer download o al expirar.';
