-- 050: Revocación de sesión efectiva en RLS. get_my_role/get_my_org devuelven
-- NULL si el token_version del JWT (claim 'tv') no coincide con profiles (o si
-- el usuario está inactivo). Tras reset de contraseña / logout forzado
-- (bump_token_version) los tokens viejos pierden acceso por RLS, no solo en la UI.
-- El COALESCE evita bloqueos si el claim faltara.
CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT role FROM profiles
  WHERE id = auth.uid()
    AND is_active = true
    AND token_version = COALESCE(
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tv')::int,
      token_version
    );
$$;

CREATE OR REPLACE FUNCTION public.get_my_org()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT organization_id FROM profiles
  WHERE id = auth.uid()
    AND is_active = true
    AND token_version = COALESCE(
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tv')::int,
      token_version
    );
$$;
