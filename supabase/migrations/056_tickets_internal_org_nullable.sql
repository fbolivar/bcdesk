-- Tickets internos: organization_id NULL = trabajo propio, sin cliente.
--
-- Antes era NOT NULL, asi que todo ticket tenia que pertenecer a un cliente.
-- El correo entrante, al no poder resolver la organizacion (remitente sin
-- perfil, admin sin org), caia en "la organizacion mas antigua" e inventaba un
-- dueno: los correos de Cloudflare/Google del propio dominio quedaron bajo GVM
-- y su usuario cliente podia verlos en su portal (fuga real, verificada).
--
-- La politica tickets_select ya contempla este caso:
--   (organization_id IS NOT NULL) AND (organization_id = get_my_org())
-- => con organization_id NULL, ningun cliente ve el ticket; solo admin/agent.
ALTER TABLE public.tickets ALTER COLUMN organization_id DROP NOT NULL;

COMMENT ON COLUMN public.tickets.organization_id IS
  'Cliente dueno del ticket. NULL = ticket interno (solo visible para admin/agent).';
