-- ============================================================
-- 028 · Hashear tokens de organización (org_api_tokens)
-- ============================================================
-- Antes: el token se guardaba en texto plano y se comparaba con .eq('token', x).
-- Un volcado de la BD exponía todos los tokens usables (widget, /api/v1/*).
-- Ahora: solo se guarda el HASH SHA-256; el token en claro se muestra UNA vez
-- al crearlo. La validación hashea el token entrante y busca por token_hash.
--
-- Seguro: la tabla tiene 0 filas (pre-lanzamiento), no hay backfill.
-- ============================================================

ALTER TABLE public.org_api_tokens DROP COLUMN IF EXISTS token;
ALTER TABLE public.org_api_tokens ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE public.org_api_tokens ADD COLUMN IF NOT EXISTS token_prefix text;
CREATE UNIQUE INDEX IF NOT EXISTS org_api_tokens_token_hash_key ON public.org_api_tokens (token_hash);
