-- 064: Enrolamiento con instalador genérico (un solo instalador por cliente).
--
-- Antes: cada equipo se daba de alta a mano y su instalador llevaba un token
-- individual. Para desplegar decenas de equipos eso no escala.
--
-- Ahora: cada cliente tiene un "enroll token" (token de enrolamiento). El
-- instalador genérico lo lleva embebido. En el primer arranque el agente llama a
-- /api/rmm/enroll con su machine_id + hostname y el servidor le crea (o
-- reutiliza) su endpoint y le devuelve SU token individual, que el agente guarda.
--
-- machine_id (MachineGuid en Windows / /etc/machine-id en Linux) identifica el
-- equipo de forma estable: reinstalar el agente o renombrar el PC NO duplica el
-- endpoint. El índice único (organization_id, machine_id) lo garantiza.

-- Token de enrolamiento por organización (solo el hash; el crudo se muestra 1 vez).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS rmm_enroll_token_hash   text,
  ADD COLUMN IF NOT EXISTS rmm_enroll_token_prefix text;

-- Identificador estable de hardware por endpoint.
ALTER TABLE public.endpoints
  ADD COLUMN IF NOT EXISTS machine_id text;

-- Un equipo (machine_id) = un endpoint por cliente. Parcial: los endpoints
-- creados a mano (sin machine_id) no chocan entre sí.
CREATE UNIQUE INDEX IF NOT EXISTS uq_endpoints_org_machine
  ON public.endpoints (organization_id, machine_id)
  WHERE machine_id IS NOT NULL;

-- Búsqueda del cliente por hash del enroll token en /api/rmm/enroll.
CREATE INDEX IF NOT EXISTS idx_orgs_enroll_token_hash
  ON public.organizations (rmm_enroll_token_hash)
  WHERE rmm_enroll_token_hash IS NOT NULL;
