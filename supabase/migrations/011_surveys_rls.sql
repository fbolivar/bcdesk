-- 011_surveys_rls.sql
-- Fix: los clientes no podían leer encuestas activas (RLS las bloqueaba),
-- por lo que /client/survey/[id] siempre redirigía al dashboard y el flujo
-- CSAT/NPS quedaba inaccesible. Políticas aditivas (se combinan con OR con
-- las de admin/agent existentes).

-- Miembros de la organización pueden leer las encuestas activas de su org
DROP POLICY IF EXISTS "surveys_client_select" ON surveys;
CREATE POLICY "surveys_client_select" ON surveys FOR SELECT
  USING (is_active = true AND organization_id = get_my_org());

-- El encuestado puede insertar su propia respuesta
DROP POLICY IF EXISTS "survey_responses_own_insert" ON survey_responses;
CREATE POLICY "survey_responses_own_insert" ON survey_responses FOR INSERT
  WITH CHECK (respondent_id = auth.uid());

-- El encuestado puede ver su respuesta; admin/agent ven todas
DROP POLICY IF EXISTS "survey_responses_own_select" ON survey_responses;
CREATE POLICY "survey_responses_own_select" ON survey_responses FOR SELECT
  USING (respondent_id = auth.uid() OR get_my_role() IN ('admin', 'agent'));
