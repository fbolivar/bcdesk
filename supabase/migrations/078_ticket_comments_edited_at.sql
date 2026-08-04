-- 078: marca de edición de comentarios. Permite mostrar "editado" en el hilo.
alter table public.ticket_comments
  add column if not exists edited_at timestamptz;
