-- 014_business_hours_types.sql
-- Permite múltiples "tipos" de horario laboral (plantillas con nombre) en vez
-- de un único horario por organización. Agrega columna `name`, reemplaza el
-- índice único por (organización, nombre, día) y siembra 3 plantillas globales.

ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Estándar';

-- Reemplaza cualquier constraint/índice único previo por uno que incluya el nombre
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'business_hours'::regclass AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE business_hours DROP CONSTRAINT ' || quote_ident(c);
  END LOOP;
END $$;

DROP INDEX IF EXISTS business_hours_org_name_day_uidx;
CREATE UNIQUE INDEX business_hours_org_name_day_uidx
  ON business_hours (organization_id, name, day_of_week);

-- Reinicia y siembra 3 plantillas globales (0=Dom .. 6=Sáb)
DELETE FROM business_hours;

INSERT INTO business_hours (organization_id, name, day_of_week, is_open, open_time, close_time, timezone)
SELECT NULL, t.name, d.dow,
       CASE WHEN t.name = '24x7 Crítico' THEN true ELSE d.dow BETWEEN 1 AND 5 END,
       t.open_time, t.close_time, 'America/Bogota'
FROM (VALUES
  ('Estándar 8x5',  TIME '08:00', TIME '18:00'),
  ('Extendido 12x5',TIME '06:00', TIME '18:00'),
  ('24x7 Crítico',  TIME '00:00', TIME '23:59')
) AS t(name, open_time, close_time)
CROSS JOIN (SELECT generate_series(0,6) AS dow) AS d;
