-- 012_project_comments.sql
-- Fix: la tabla project_comments no existía, por lo que el hilo de comentarios
-- en /client/projects/[id] (y su formulario) no funcionaba. La página ya degrada
-- con gracia (hasCommentTable), pero el feature quedaba inaccesible.

CREATE TABLE IF NOT EXISTS project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments(project_id);

ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

-- Miembros de la org (o admin/agent) pueden ver los comentarios de sus proyectos
DROP POLICY IF EXISTS "project_comments_select" ON project_comments;
CREATE POLICY "project_comments_select" ON project_comments FOR SELECT USING (
  get_my_role() IN ('admin', 'agent')
  OR project_id IN (SELECT id FROM projects WHERE organization_id = get_my_org())
);

-- Cualquier miembro autorizado puede comentar como sí mismo en proyectos de su org
DROP POLICY IF EXISTS "project_comments_insert" ON project_comments;
CREATE POLICY "project_comments_insert" ON project_comments FOR INSERT WITH CHECK (
  author_id = auth.uid()
  AND (
    get_my_role() IN ('admin', 'agent')
    OR project_id IN (SELECT id FROM projects WHERE organization_id = get_my_org())
  )
);
