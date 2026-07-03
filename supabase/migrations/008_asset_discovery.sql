-- ============================================================
-- 008 — Auto-descubrimiento de activos (CMDB)
-- ============================================================
-- Permite que un agente de inventario reporte activos vía API y marca la
-- procedencia y el último contacto de cada CI.
-- ============================================================
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS assets_source_idx ON assets (source);
