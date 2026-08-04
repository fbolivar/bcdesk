-- 077: El bucket ticket-attachments tenía una allowlist de MIME MÁS ESTRECHA que
-- la de la app (validateUpload). Archivos que la app aceptaba (HEIC de iPhone, CSV,
-- PowerPoint, avif, tiff, bmp...) los rechazaba el bucket con 415, y la ruta de
-- carga se tragaba el error en silencio => "no guarda nada" al adjuntar evidencia.
--
-- Fix anti-recurrencia: una sola lista blanca. La barrera real es validateUpload en
-- la app (bloquea html/svg y ejecutables, valida tamaño). El bucket deja de imponer
-- su propia lista (que se desincronizaba) y solo mantiene el límite de 10 MB y su
-- carácter privado (se sirve con signed URLs).
update storage.buckets
set allowed_mime_types = null
where id = 'ticket-attachments';
