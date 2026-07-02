-- ============================================================
-- 006 — Recuperación de contraseña (olvidé mi contraseña)
-- ============================================================
-- Tokens de un solo uso con expiración. Solo el service role los toca
-- (RLS activo sin políticas).
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token      TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo el service role accede.
