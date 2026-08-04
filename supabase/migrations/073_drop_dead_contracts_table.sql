-- 073: Elimina la tabla legacy `contracts` (sin uso).
-- Los contratos reales viven en `service_contracts`. `contracts` estaba vacía y
-- sin dependencias; causó el bug del portal cliente que leía esta tabla en vez de
-- service_contracts. Se elimina para evitar confusiones futuras.
DROP TABLE IF EXISTS public.contracts;
