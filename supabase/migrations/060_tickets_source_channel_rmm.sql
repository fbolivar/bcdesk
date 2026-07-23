-- 060: agregar 'rmm' a los canales de origen válidos de un ticket.
-- Los tickets creados por el cron de alertas RMM usan source_channel='rmm';
-- sin esto, el CHECK los rechazaba y el ticket no se creaba.
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_source_channel_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_source_channel_check
  CHECK (source_channel = ANY (ARRAY['web','email','whatsapp','chat','widget','api','phone','rmm']));
