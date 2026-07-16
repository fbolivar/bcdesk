-- 052: Revierte la 045 (protect_password_hash_column).
--
-- POR QUE:
-- La 045 quito el SELECT a nivel de TABLA sobre profiles y lo devolvio columna
-- por columna, excepto password_hash. Postgres rechaza un `SELECT *` completo si
-- al rol le falta privilegio sobre UNA sola columna, asi que toda consulta
-- `.select('*')` sobre profiles empezo a fallar con:
--     ERROR 42501: permission denied for table profiles
-- Efecto en produccion: las pantallas de Miembros, Clientes y Organizaciones
-- quedaron vacias (parecia perdida de datos; los datos nunca se tocaron).
-- Los tickets seguian visibles porque no consultan profiles.*.
--
-- ESTADO ACTUAL:
-- Se restaura el SELECT a nivel de tabla para authenticated. La RLS sigue
-- gobernando QUE FILAS ve cada rol (un cliente solo ve su fila y la del agente
-- asignado a sus tickets). anon permanece SIN acceso a profiles.
--
-- DEUDA PENDIENTE (hardening correcto):
-- Con este grant, un usuario autenticado puede leer password_hash de las filas
-- que la RLS le permita ver. La solucion correcta NO son grants por columna,
-- sino sacar el hash de profiles a una tabla aparte accesible solo por
-- service_role. Requiere tocar el flujo de auth, por eso se hace aparte.

GRANT SELECT ON public.profiles TO authenticated;
REVOKE SELECT ON public.profiles FROM anon;
