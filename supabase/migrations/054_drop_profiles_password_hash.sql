-- Fase 2 del movimiento del hash (ver 053).
-- Se aplica solo tras verificar el login real en produccion y comprobar que
-- ningun punto del codigo lee/escribe ya profiles.password_hash.
--
-- Por que hay que borrarla: mientras la columna existiera, los hashes seguian
-- siendo legibles por cualquier usuario autenticado via `select *` sobre
-- profiles (que es exactamente el hueco que la 045 intentaba tapar).
-- Los hashes vigentes viven en user_credentials, sin acceso para anon/authenticated.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS password_hash;
