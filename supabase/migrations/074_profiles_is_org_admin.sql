-- 074: "Administrador de cliente".
-- Un usuario cliente con is_org_admin = true puede gestionar el equipo de SU
-- organización (invitar/activar/desactivar miembros, todos con rol cliente). NO
-- otorga ningún acceso al backoffice ni a otras organizaciones.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_org_admin boolean DEFAULT false;
