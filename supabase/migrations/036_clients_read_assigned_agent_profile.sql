-- 036: El cliente puede ver el perfil del agente asignado a sus tickets
--
-- Problema: la vista de ticket del cliente mostraba "Sin agente asignado"
-- aunque el ticket SI tuviera agente. Causa: la politica profiles_select
-- solo deja al cliente leer su propio perfil (id = auth.uid()), por lo que
-- el lookup del perfil del agente devolvia null.
--
-- Fix: politica permisiva adicional que deja al cliente leer el perfil de
-- un agente SOLO si ese agente esta asignado a un ticket de SU organizacion.
-- Exposicion minima. Sin recursion: usa get_my_org() (SECURITY DEFINER),
-- no consulta profiles directamente.

DROP POLICY IF EXISTS "profiles_select_assigned_agent" ON profiles;
CREATE POLICY "profiles_select_assigned_agent" ON profiles FOR SELECT USING (
  id IN (
    SELECT assigned_to FROM tickets
    WHERE organization_id = (select public.get_my_org())
      AND assigned_to IS NOT NULL
  )
);
