-- ============================================================
-- 009 — Sincronización de directorio (AD/LDAP)
-- ============================================================
-- Marca el origen de autenticación de cada perfil. Los usuarios provisionados
-- desde Active Directory/LDAP se marcan como 'ldap' y se sincronizan vía API.
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_source TEXT NOT NULL DEFAULT 'local';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS directory_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_auth_source_idx ON profiles (auth_source);
