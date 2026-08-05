-- 079: alias editable por el admin para un equipo RMM. El agente reporta el
-- hostname real en cada heartbeat (se sobrescribiría), así que el nombre "amigable"
-- se guarda aparte. La UI muestra display_name ?? hostname.
alter table public.endpoints
  add column if not exists display_name text;
