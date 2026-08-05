/**
 * Renderiza texto libre (que puede contener correos) evitando el bug de
 * hidratación causado por Cloudflare "Email Address Obfuscation".
 *
 * Cloudflare reescribe los correos que ve en el HTML del servidor (los envuelve
 * en <a>/<span>), con lo que el DOM deja de coincidir con lo que renderizó React
 * → error de hidratación #418 → la página queda sin interactividad.
 *
 * Blindaje doble:
 *  1) Envolvemos el contenido con los marcadores <!--email_off--> … <!--/email_off-->,
 *     que Cloudflare respeta para NO ofuscar ese fragmento.
 *  2) Lo inyectamos con dangerouslySetInnerHTML: React trata ese HTML como opaco y
 *     no lo re-concilia en la hidratación, así que aunque algo lo modifique no hay
 *     error #418.
 *
 * Seguridad: el texto se ESCAPA (no se interpreta HTML del usuario) → sin XSS. Los
 * saltos de línea se conservan con la clase whitespace-pre-wrap del contenedor.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type Props = {
  text: string | null | undefined
  className?: string
  as?: 'div' | 'span' | 'p'
  title?: string
}

export function CfSafeText({ text, className, as = 'div', title }: Props) {
  const html = `<!--email_off-->${escapeHtml(text ?? '')}<!--/email_off-->`
  const Tag = as
  return <Tag className={className} title={title} dangerouslySetInnerHTML={{ __html: html }} />
}
