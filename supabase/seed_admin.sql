-- ============================================================
-- Seed del primer administrador (ejecutar UNA vez, después de 004_custom_auth.sql)
-- ============================================================
-- Credenciales: fbolivarb@gmail.com  /  BcDesk2026!
-- (Cambia la contraseña después de entrar. El hash es bcrypt, cost 10.)
--
-- Usa UPSERT para reutilizar el perfil que pudo quedar de un registro previo.
-- ============================================================
INSERT INTO profiles (email, full_name, role, password_hash, is_active)
VALUES (
  lower('fbolivarb@gmail.com'),
  'Fabian Bolivar',
  'admin',
  '$2b$10$upLZOh8OQWcN7ad20zlnw.VgEmcWlARTRknblBWW991Mjq146enyi',
  TRUE
)
ON CONFLICT (lower(email)) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role          = 'admin',
  is_active     = TRUE,
  full_name     = EXCLUDED.full_name;
