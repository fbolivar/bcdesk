-- ============================================================
-- 004 — Autenticación propia (reemplaza Supabase GoTrue)
-- ============================================================
-- BCDesk deja de usar el esquema de autenticación de Supabase (auth.users / GoTrue).
-- Ahora las identidades viven 100% en public.profiles con password_hash propio.
-- La sesión es un JWT firmado por la app con el JWT secret del proyecto, de modo
-- que auth.uid() (y por tanto TODAS las políticas RLS existentes) sigue funcionando.
--
-- Cambios:
--   1. profiles gana password_hash y genera su propio id (ya no depende de auth.users).
--   2. Se elimina el FK profiles.id -> auth.users y el trigger handle_new_user.
--   3. Email único (case-insensitive).
--   4. Funciones SECURITY DEFINER para login/registro/invitación, ejecutables por
--      el rol anónimo (bypass RLS de forma controlada, solo lo mínimo necesario).
-- ============================================================

-- 1. Columna de contraseña -----------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Desacoplar de auth.users --------------------------------
-- Soltar el FK a auth.users (nombre por defecto: profiles_id_fkey).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;
END $$;

-- profiles ahora genera su propio id
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Quitar el trigger/función que sincronizaba con auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- 3. Email único (case-insensitive) --------------------------
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON profiles (lower(email));

-- ============================================================
-- 4. Funciones de autenticación (SECURITY DEFINER)
-- ============================================================

-- Login: devuelve lo mínimo para verificar credenciales en el servidor.
CREATE OR REPLACE FUNCTION auth_get_user_by_email(p_email TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  organization_id UUID,
  password_hash TEXT,
  is_active BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.full_name, p.role, p.organization_id, p.password_hash, p.is_active
  FROM profiles p
  WHERE lower(p.email) = lower(p_email)
  LIMIT 1;
$$;

-- Registro público (rol client por defecto).
CREATE OR REPLACE FUNCTION auth_register_user(
  p_email TEXT,
  p_password_hash TEXT,
  p_full_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE lower(email) = lower(p_email)) THEN
    RAISE EXCEPTION 'EMAIL_TAKEN' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO profiles (email, full_name, role, password_hash, is_active)
  VALUES (lower(p_email), p_full_name, 'client', p_password_hash, TRUE)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Leer una invitación por token (para el invitado anónimo; RLS lo bloquearía).
CREATE OR REPLACE FUNCTION auth_get_invitation(p_token TEXT)
RETURNS TABLE (email TEXT, role TEXT, organization_id UUID, org_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.email, i.role, i.organization_id, o.name
  FROM invitations i
  LEFT JOIN organizations o ON o.id = i.organization_id
  WHERE i.token = p_token AND i.accepted_at IS NULL
  LIMIT 1;
$$;

-- Completar registro por invitación: crea el perfil con el rol/org de la invitación.
CREATE OR REPLACE FUNCTION auth_complete_invite(
  p_token TEXT,
  p_password_hash TEXT,
  p_full_name TEXT
)
RETURNS TABLE (id UUID, email TEXT, role TEXT, organization_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv  invitations%ROWTYPE;
  v_id   UUID;
BEGIN
  SELECT * INTO v_inv
  FROM invitations
  WHERE token = p_token AND accepted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_INVALID';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE lower(email) = lower(v_inv.email)) THEN
    RAISE EXCEPTION 'EMAIL_TAKEN' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO profiles (email, full_name, role, organization_id, password_hash, is_active)
  VALUES (lower(v_inv.email), p_full_name, v_inv.role, v_inv.organization_id, p_password_hash, TRUE)
  RETURNING profiles.id INTO v_id;

  UPDATE invitations SET accepted_at = NOW() WHERE token = p_token;

  RETURN QUERY SELECT v_id, v_inv.email, v_inv.role, v_inv.organization_id;
END;
$$;

-- Permisos: el rol anónimo puede ejecutar SOLO estas funciones puntuales.
GRANT EXECUTE ON FUNCTION auth_get_user_by_email(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth_register_user(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION auth_get_invitation(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION auth_complete_invite(TEXT, TEXT, TEXT) TO anon;
