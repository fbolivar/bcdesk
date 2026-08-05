-- 080: el portal del cliente lee endpoints por RLS (rol authenticated) y el acceso
-- es por columna (mig 065). display_name es un alias no sensible → se expone al
-- cliente para que vea el mismo nombre amigable que el staff. El resto de columnas
-- sensibles (token_hash, machine_id, etc.) siguen sin GRANT.
grant select (display_name) on public.endpoints to authenticated;
