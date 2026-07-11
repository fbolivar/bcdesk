-- 048: Bloquea next_doc_number. Antes cualquier anon (con la anon key pública)
-- podía llamarla y alterar el consecutivo de facturas/visitas. Ahora exige rol
-- staff dentro de la función y se revoca EXECUTE a anon/PUBLIC.
CREATE OR REPLACE FUNCTION next_doc_number(p_prefix TEXT, p_year INT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v INT;
BEGIN
  IF get_my_role() NOT IN ('admin','agent') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  INSERT INTO doc_counters(scope, counter)
  VALUES (p_prefix || '-' || p_year, 1)
  ON CONFLICT (scope) DO UPDATE SET counter = doc_counters.counter + 1
  RETURNING counter INTO v;
  RETURN p_prefix || '-' || p_year || '-' || lpad(v::text, 4, '0');
END $$;

REVOKE EXECUTE ON FUNCTION next_doc_number(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION next_doc_number(text, int) TO authenticated, service_role;
