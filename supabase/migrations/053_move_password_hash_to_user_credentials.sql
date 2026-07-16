-- Saca password_hash de profiles a una tabla aislada solo-servidor.
-- Fase 1: aditiva. NO se borra profiles.password_hash todavia (rollback seguro).
--
-- Contexto: la 045 intento proteger el hash con grants por columna y rompio
-- todo `select *` sobre profiles (ver 052). La forma correcta no son grants por
-- columna, sino que el hash no viva en una tabla que los usuarios leen.

CREATE TABLE IF NOT EXISTS public.user_credentials (
  user_id       uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Sin acceso para clientes del navegador: solo service_role y SECURITY DEFINER.
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_credentials FROM anon, authenticated;
GRANT ALL ON public.user_credentials TO service_role;

INSERT INTO public.user_credentials (user_id, password_hash)
SELECT id, password_hash FROM public.profiles WHERE password_hash IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- ── Funciones: misma firma, ahora leen/escriben en user_credentials ──

CREATE OR REPLACE FUNCTION public.auth_get_user_by_email(p_email text)
 RETURNS TABLE(id uuid, email text, full_name text, role text, organization_id uuid, password_hash text, is_active boolean, token_version integer)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, p.email, p.full_name, p.role, p.organization_id,
         c.password_hash, p.is_active, p.token_version
  FROM profiles p
  LEFT JOIN user_credentials c ON c.user_id = p.id
  WHERE lower(p.email) = lower(p_email)
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.auth_register_user(p_email text, p_password_hash text, p_full_name text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE lower(email) = lower(p_email)) THEN
    RAISE EXCEPTION 'EMAIL_TAKEN' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO profiles (email, full_name, role, is_active)
  VALUES (lower(p_email), p_full_name, 'client', TRUE)
  RETURNING id INTO v_id;

  INSERT INTO user_credentials (user_id, password_hash) VALUES (v_id, p_password_hash);

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auth_complete_invite(p_token text, p_password_hash text, p_full_name text)
 RETURNS TABLE(id uuid, email text, role text, organization_id uuid)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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

  INSERT INTO profiles (email, full_name, role, organization_id, is_active)
  VALUES (lower(v_inv.email), p_full_name, v_inv.role, v_inv.organization_id, TRUE)
  RETURNING profiles.id INTO v_id;

  INSERT INTO user_credentials (user_id, password_hash) VALUES (v_id, p_password_hash);

  UPDATE invitations SET accepted_at = NOW() WHERE token = p_token;

  RETURN QUERY SELECT v_id, v_inv.email, v_inv.role, v_inv.organization_id;
END;
$function$;
