import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { hashOrgToken } from '@/lib/api/org-token-crypto'

interface Props { params: Promise<{ token: string }> }

export default async function WidgetChatPage({ params }: Props) {
  const { token } = await params
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const supabase = createServiceClient()

  const { data: apiToken } = await supabase
    .from('org_api_tokens')
    .select('id, is_active, organizations(name)')
    .eq('token_hash', await hashOrgToken(token)).single()

  if (!apiToken?.is_active) {
    return (
      <html><body style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#5B6B7C', fontSize: '14px' }}>Chat no disponible.</p>
      </body></html>
    )
  }

  const orgName = (apiToken.organizations as { name?: string } | null)?.name ?? 'Soporte'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Chat con soporte</title>
        <style nonce={nonce}>{`
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:system-ui,-apple-system,sans-serif;background:#F1F4F8;height:100vh;display:flex;flex-direction:column;color:#0B2545}
          #intro{padding:24px;flex:1;display:flex;flex-direction:column;gap:12px;justify-content:center}
          #chat-view{flex:1;display:none;flex-direction:column}
          .header{background:#0B2545;color:#fff;padding:16px;font-size:14px;font-weight:600}
          .header small{display:block;font-size:11px;opacity:.85;font-weight:400;margin-top:2px}
          #messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;background:#F1F4F8}
          .msg{max-width:80%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.4}
          .msg.visitor{background:#00D4AA;color:#fff;align-self:flex-end;border-radius:12px 12px 4px 12px}
          .msg.agent{background:#fff;color:#0B2545;align-self:flex-start;border-radius:12px 12px 12px 4px;border:1px solid #E6EBF2}
          .msg.system{background:#E6EBF2;color:#5B6B7C;align-self:center;font-size:11px;border-radius:8px}
          #input-area{padding:12px;border-top:1px solid #E6EBF2;display:flex;gap:8px;background:#fff}
          #msg-input{flex:1;padding:8px 12px;border:1px solid #CBD5E1;border-radius:20px;font-size:13px;outline:none;font-family:inherit;color:#0B2545}
          #msg-input:focus{border-color:#00D4AA}
          #send-btn{padding:8px 16px;background:#00D4AA;color:#fff;border:none;border-radius:20px;font-size:13px;cursor:pointer;font-weight:500}
          #send-btn:hover{background:#00B392}
          #send-btn:disabled{background:#94A3B8;cursor:not-allowed}
          h2{font-size:18px;font-weight:700;color:#0B2545}
          p{font-size:13px;color:#5B6B7C}
          label{font-size:12px;font-weight:500;color:#5B6B7C;display:block;margin-bottom:4px}
          input[type=text],input[type=email]{width:100%;padding:8px 12px;border:1px solid #CBD5E1;border-radius:8px;font-size:13px;outline:none;font-family:inherit;color:#0B2545}
          input:focus{border-color:#00D4AA}
          button.primary{width:100%;padding:10px;background:#00D4AA;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer}
          button.primary:hover{background:#00B392}
        `}</style>
      </head>
      <body>
        {/* Intro form */}
        <div id="intro">
          <h2>💬 Chat con soporte</h2>
          <p>{orgName} — Estamos aquí para ayudarte</p>
          <div><label htmlFor="v-name">Nombre *</label><input type="text" id="v-name" placeholder="Tu nombre" /></div>
          <div><label htmlFor="v-email">Correo</label><input type="email" id="v-email" placeholder="tu@correo.com" /></div>
          <button className="primary" id="start-btn">Iniciar chat</button>
        </div>

        {/* Chat view */}
        <div id="chat-view">
          <div className="header">
            💬 {orgName} — Soporte
            <small id="status-text">Conectando con un agente…</small>
          </div>
          <div id="messages">
            <div className="msg system">Chat iniciado. Un agente te atenderá pronto.</div>
          </div>
          <div id="input-area">
            <input type="text" id="msg-input" placeholder="Escribe tu mensaje…" />
            <button id="send-btn">Enviar</button>
          </div>
        </div>

        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `
          (function () {
            var APP_URL = ${JSON.stringify(appUrl)};
            var TOKEN = ${JSON.stringify(token)};
            var sessionId = null;
            var lastTs = null;
            var poll = null;

            function el(id) { return document.getElementById(id); }

            function appendMessage(text, type) {
              var d = document.createElement('div');
              d.className = 'msg ' + type;
              d.textContent = text;
              var m = el('messages');
              m.appendChild(d);
              m.scrollTop = m.scrollHeight;
            }

            async function tick() {
              if (!sessionId) return;
              try {
                var url = APP_URL + '/api/chat/messages?session_id=' + encodeURIComponent(sessionId) +
                  (lastTs ? '&after=' + encodeURIComponent(lastTs) : '');
                var res = await fetch(url, { headers: { 'x-widget-token': TOKEN } });
                if (!res.ok) return;
                var data = await res.json();
                (data.messages || []).forEach(function (msg) {
                  lastTs = msg.created_at;
                  if (msg.sender_type !== 'visitor') {
                    appendMessage(msg.content, msg.sender_type === 'system' ? 'system' : 'agent');
                    el('status-text').textContent = 'Agente en línea ●';
                  }
                });
                if (data.status === 'active') {
                  el('status-text').textContent = 'Agente en línea ●';
                } else if (data.status === 'closed') {
                  el('status-text').textContent = 'Chat cerrado';
                  el('send-btn').disabled = true;
                  if (poll) clearInterval(poll);
                }
              } catch (e) { /* reintenta en el próximo ciclo */ }
            }

            async function startChat() {
              var name = el('v-name').value.trim();
              if (!name) { alert('Por favor ingresa tu nombre'); return; }
              var email = el('v-email').value.trim();
              var res = await fetch(APP_URL + '/api/chat/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-widget-token': TOKEN },
                body: JSON.stringify({ visitor_name: name, visitor_email: email || undefined })
              });
              if (!res.ok) { alert('Error al iniciar chat'); return; }
              var data = await res.json();
              sessionId = data.session_id;
              el('intro').style.display = 'none';
              el('chat-view').style.display = 'flex';
              tick();
              poll = setInterval(tick, 2500);
            }

            async function sendMsg() {
              var input = el('msg-input');
              var content = input.value.trim();
              if (!content || !sessionId) return;
              input.value = '';
              appendMessage(content, 'visitor');
              await fetch(APP_URL + '/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-widget-token': TOKEN },
                body: JSON.stringify({ session_id: sessionId, content: content })
              });
            }

            el('start-btn').addEventListener('click', startChat);
            el('send-btn').addEventListener('click', sendMsg);
            el('msg-input').addEventListener('keydown', function (e) {
              if (e.key === 'Enter') sendMsg();
            });
          })();
        `}} />
      </body>
    </html>
  )
}
