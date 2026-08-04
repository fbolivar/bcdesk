-- 076: Un usuario puede ver a los miembros de SU propia organización.
-- Antes, la RLS de profiles solo dejaba a un cliente verse a sí mismo (y a los
-- agentes asignados), así que "Mi Equipo" mostraba 1 solo miembro. Esta política
-- permite ver a los compañeros de la misma organización. El staff (organization_id
-- NULL) NO queda expuesto: get_my_org() nunca coincide con NULL.
CREATE POLICY profiles_select_org_members ON public.profiles
  FOR SELECT
  USING (organization_id IS NOT NULL AND organization_id = (SELECT public.get_my_org()));
