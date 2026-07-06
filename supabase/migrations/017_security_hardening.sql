-- 017_security_hardening.sql
-- Corrige vulnerabilidades críticas encontradas en la auditoría:
--  1) Escalada de privilegios: un usuario podía cambiar su propio role/organization_id
--     vía profiles UPDATE (RLS sin restricción de columnas).
--  2) Fuga de chat: chat_messages/chat_sessions eran legibles por anónimos y
--     entre usuarios (RLS ausente o permisiva).

-- ── 1) Bloquear cambio de privilegios en profiles (excepto admin) ────────────
CREATE OR REPLACE FUNCTION prevent_profile_privilege_change()
RETURNS trigger AS $$
BEGIN
  -- Si quien actualiza no es admin, no puede cambiar role/organization_id/is_active
  IF get_my_role() <> 'admin' THEN
    NEW.role            := OLD.role;
    NEW.organization_id := OLD.organization_id;
    NEW.is_active       := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_profile_priv ON profiles;
CREATE TRIGGER trg_prevent_profile_priv
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_change();

-- ── 2) RLS de chat: solo staff o el propio visitante autenticado ─────────────
-- Elimina cualquier política previa (incluidas las permisivas para anon)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE tablename IN ('chat_messages','chat_sessions') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_sessions_access ON chat_sessions FOR ALL
  USING (get_my_role() IN ('admin','agent') OR visitor_id = auth.uid())
  WITH CHECK (get_my_role() IN ('admin','agent') OR visitor_id = auth.uid());

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_access ON chat_messages FOR ALL
  USING (
    get_my_role() IN ('admin','agent')
    OR session_id IN (SELECT id FROM chat_sessions WHERE visitor_id = auth.uid())
  )
  WITH CHECK (
    get_my_role() IN ('admin','agent')
    OR session_id IN (SELECT id FROM chat_sessions WHERE visitor_id = auth.uid())
  );

-- Nota: el widget público anónimo (widget/[token]/chat) ya no podrá leer
-- mensajes por Realtime con la anon key. Requiere rediseño para servir los
-- mensajes vía un endpoint autenticado por token de widget (pendiente).
