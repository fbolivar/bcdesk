-- 044: Numeración de documentos a prueba de duplicados.
-- Contador atómico por prefijo+año que nunca reutiliza un número (aunque se
-- borren documentos) y reinicia por año. Reemplaza el patrón count(*)+1.
CREATE TABLE IF NOT EXISTS doc_counters (
  scope    TEXT PRIMARY KEY,
  counter  INT NOT NULL DEFAULT 0
);
ALTER TABLE doc_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION next_doc_number(p_prefix TEXT, p_year INT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v INT;
BEGIN
  INSERT INTO doc_counters(scope, counter)
  VALUES (p_prefix || '-' || p_year, 1)
  ON CONFLICT (scope) DO UPDATE SET counter = doc_counters.counter + 1
  RETURNING counter INTO v;
  RETURN p_prefix || '-' || p_year || '-' || lpad(v::text, 4, '0');
END $$;
GRANT EXECUTE ON FUNCTION next_doc_number(TEXT, INT) TO authenticated;

INSERT INTO doc_counters(scope, counter)
SELECT 'BC-' || split_part(invoice_number, '-', 2), MAX(split_part(invoice_number, '-', 3)::int)
FROM invoices WHERE invoice_number LIKE 'BC-%-%'
GROUP BY split_part(invoice_number, '-', 2)
ON CONFLICT (scope) DO UPDATE SET counter = GREATEST(doc_counters.counter, EXCLUDED.counter);

INSERT INTO doc_counters(scope, counter)
SELECT 'VT-' || split_part(visit_number, '-', 2), MAX(split_part(visit_number, '-', 3)::int)
FROM technical_visits WHERE visit_number LIKE 'VT-%-%'
GROUP BY split_part(visit_number, '-', 2)
ON CONFLICT (scope) DO UPDATE SET counter = GREATEST(doc_counters.counter, EXCLUDED.counter);
