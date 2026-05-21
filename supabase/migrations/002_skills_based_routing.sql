-- Migration: Skills-based routing
-- Skills disponibles en el sistema

CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  category text NOT NULL DEFAULT 'technical' CHECK (category IN ('technical','billing','product','language','other')),
  color text NOT NULL DEFAULT '#4F8AFF',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Skills de cada agente
CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id uuid REFERENCES skills(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  PRIMARY KEY (agent_id, skill_id)
);

-- Reglas de routing: si el ticket tiene esta categoría/prioridad, asignar al agente con este skill
CREATE TABLE IF NOT EXISTS routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  skill_id uuid REFERENCES skills(id) ON DELETE CASCADE,
  ticket_category text,
  ticket_priority text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS agent_skills_agent_id_idx ON agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS agent_skills_skill_id_idx ON agent_skills(skill_id);

-- RLS
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_skills" ON skills FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admins_manage_skills" ON skills FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "authenticated_read_agent_skills" ON agent_skills FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admins_manage_agent_skills" ON agent_skills FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admins_manage_routing_rules" ON routing_rules FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "agents_read_routing_rules" ON routing_rules FOR SELECT USING (auth.uid() IS NOT NULL);

-- Seeds de skills de ejemplo
INSERT INTO skills (name, description, category, color) VALUES
  ('Red & Conectividad', 'Diagnóstico de problemas de red', 'technical', '#4F8AFF'),
  ('Hardware', 'Soporte de hardware y equipos', 'technical', '#8B6FFF'),
  ('Software', 'Instalación y configuración de software', 'technical', '#00D4FF'),
  ('Facturación', 'Dudas de facturación y pagos', 'billing', '#FFB547'),
  ('Español', 'Soporte en español', 'language', '#10D98A'),
  ('Inglés', 'Soporte en inglés', 'language', '#10D98A')
ON CONFLICT (name) DO NOTHING;
