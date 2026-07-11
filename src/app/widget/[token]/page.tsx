import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { hashOrgToken } from '@/lib/api/org-token-crypto'

interface Props { params: Promise<{ token: string }> }

export default async function WidgetPage({ params }: Props) {
  const { token } = await params
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const supabase = createServiceClient()

  const { data: apiToken } = await supabase
    .from('org_api_tokens')
    .select('id, is_active, organizations(name)')
    .eq('token_hash', await hashOrgToken(token))
    .single()

  if (!apiToken?.is_active) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-400 text-sm">Widget no disponible.</p>
      </div>
    )
  }

  const orgName = (apiToken.organizations as any)?.name ?? 'Soporte'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Soporte</title>
        <style nonce={nonce}>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, -apple-system, sans-serif; background: #fff; }
          .widget { max-width: 400px; margin: 0 auto; padding: 24px; }
          h2 { font-size: 16px; font-weight: 600; color: #0B2545; margin-bottom: 4px; }
          p { font-size: 13px; color: #5B6B7C; margin-bottom: 20px; }
          label { display: block; font-size: 12px; font-weight: 500; color: #5B6B7C; margin-bottom: 4px; }
          input, textarea, select {
            width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
            font-size: 13px; color: #0B2545; outline: none; background: #f8fafc;
            margin-bottom: 12px; font-family: inherit;
          }
          input:focus, textarea:focus, select:focus { border-color: #00D4AA; background: #fff; }
          button {
            width: 100%; padding: 10px; background: #00D4AA; color: white; border: none;
            border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;
          }
          button:hover { background: #00B392; }
          button:disabled { background: #5B6B7C; cursor: not-allowed; }
          .success { text-align: center; padding: 32px 0; }
          .success .icon { font-size: 40px; margin-bottom: 12px; }
          .success h3 { font-size: 16px; font-weight: 600; color: #10b981; margin-bottom: 6px; }
          .success p { font-size: 13px; color: #5B6B7C; }
          .error-msg { color: #ef4444; font-size: 12px; margin-top: -8px; margin-bottom: 8px; }
        `}</style>
      </head>
      <body>
        <div className="widget" id="widget">
          <h2>Contactar soporte</h2>
          <p>{orgName} · Te responderemos a la brevedad</p>
          <form id="ticketForm">
            <label>Nombre completo *</label>
            <input type="text" name="name" required placeholder="Tu nombre" />
            <label>Correo electrónico *</label>
            <input type="email" name="email" required placeholder="tu@correo.com" />
            <label>Asunto *</label>
            <input type="text" name="subject" required placeholder="¿En qué podemos ayudarte?" />
            <label>Categoría</label>
            <select name="category">
              <option value="support">Soporte técnico</option>
              <option value="billing">Facturación</option>
              <option value="onboarding">Onboarding</option>
              <option value="other">Otro</option>
            </select>
            <label>Mensaje *</label>
            <textarea name="message" required rows={4} placeholder="Describe tu consulta..."></textarea>
            <button type="submit" id="submitBtn">Enviar consulta</button>
          </form>
          <div id="successMsg" style={{ display: 'none' }} className="success">
            <div className="icon">✅</div>
            <h3>¡Ticket creado!</h3>
            <p>Te contactaremos al correo indicado.</p>
          </div>
          <div id="errorMsg" style={{ display: 'none' }} className="error-msg"></div>
        </div>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `
          document.getElementById('ticketForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            btn.disabled = true;
            btn.textContent = 'Enviando...';
            const fd = new FormData(e.target);
            const body = Object.fromEntries(fd.entries());
            try {
              const res = await fetch(${JSON.stringify(appUrl)} + '/api/widget/ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-widget-token': ${JSON.stringify(token)} },
                body: JSON.stringify(body)
              });
              if (res.ok) {
                document.getElementById('ticketForm').style.display = 'none';
                document.getElementById('successMsg').style.display = 'block';
              } else {
                const data = await res.json();
                document.getElementById('errorMsg').style.display = 'block';
                document.getElementById('errorMsg').textContent = data.error || 'Error al enviar.';
                btn.disabled = false;
                btn.textContent = 'Enviar consulta';
              }
            } catch {
              document.getElementById('errorMsg').style.display = 'block';
              document.getElementById('errorMsg').textContent = 'Error de conexión.';
              btn.disabled = false;
              btn.textContent = 'Enviar consulta';
            }
          });
        `}} />
      </body>
    </html>
  )
}
