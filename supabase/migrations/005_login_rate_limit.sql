-- ============================================================
-- 005 — Rate limiting de login (anti fuerza bruta)
-- ============================================================
-- Registra intentos fallidos por clave (email) y bloquea temporalmente.
-- Solo el service role la toca (RLS activo, sin políticas → anon/authenticated no acceden).
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_login_attempts (
  key           TEXT PRIMARY KEY,
  attempts      INT NOT NULL DEFAULT 0,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE auth_login_attempts ENABLE ROW LEVEL SECURITY;
-- Sin políticas: nadie con anon/authenticated puede leer/escribir; el service role las omite.
