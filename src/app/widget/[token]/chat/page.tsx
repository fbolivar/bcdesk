import { createServiceClient } from '@/lib/supabase/service'

interface Props { params: Promise<{ token: string }> }

export default async function WidgetChatPage({ params }: Props) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: apiToken } = await supabase
    .from('org_api_tokens')
    .select('id, is_active, organizations(name)')
    .eq('token', token).single()

  if (!apiToken?.is_active) {
    return (
      <html><body style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: '#999', fontSize: '14px' }}>Chat no disponible.</p>
      </body></html>
    )
  }

  const orgName = (apiToken.organizations as any)?.name ?? 'Soporte'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Chat con soporte</title>
        <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;height:100vh;display:flex;flex-direction:column}
          #intro{padding:24px;flex:1;display:flex;flex-direction:column;gap:12px;justify-content:center}
          #chat-view{flex:1;display:none;flex-direction:column}
          .header{background:#3b82f6;color:white;padding:16px;font-size:14px;font-weight:600}
          .header small{display:block;font-size:11px;opacity:.8;font-weight:400;margin-top:2px}
          #messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
          .msg{max-width:80%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.4}
          .msg.visitor{background:#3b82f6;color:white;align-self:flex-end;border-radius:12px 12px 4px 12px}
          .msg.agent{background:white;color:#1e293b;align-self:flex-start;border-radius:12px 12px 12px 4px;border:1px solid #e2e8f0}
          .msg.system{background:#f1f5f9;color:#64748b;align-self:center;font-size:11px;border-radius:8px}
          .msg-time{font-size:10px;opacity:.6;margin-top:3px}
          #input-area{padding:12px;border-top:1px solid #e2e8f0;display:flex;gap:8px;background:white}
          #msg-input{flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:20px;font-size:13px;outline:none;font-family:inherit}
          #msg-input:focus{border-color:#3b82f6}
          #send-btn{padding:8px 16px;background:#3b82f6;color:white;border:none;border-radius:20px;font-size:13px;cursor:pointer;font-weight:500}
          #send-btn:hover{background:#2563eb}
          #send-btn:disabled{background:#94a3b8;cursor:not-allowed}
          h2{font-size:18px;font-weight:700;color:#1e293b}
          p{font-size:13px;color:#64748b}
          label{font-size:12px;font-weight:500;color:#475569;display:block;margin-bottom:4px}
          input[type=text],input[type=email]{width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;outline:none;font-family:inherit}
          input:focus{border-color:#3b82f6}
          button.primary{width:100%;padding:10px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer}
          button.primary:hover{background:#2563eb}
          .waiting{text-align:center;padding:20px;color:#64748b;font-size:13px}
          .dot{display:inline-block;animation:blink 1.4s infinite;font-size:20px}
          .dot:nth-child(2){animation-delay:.2s}
          .dot:nth-child(3){animation-delay:.4s}
          @keyframes blink{0%,80%,100%{opacity:0}40%{opacity:1}}
        `}</style>
      </head>
      <body>
        {/* Intro form */}
        <div id="intro">
          <h2>💬 Chat con soporte</h2>
          <p>{orgName} — Estamos aquí para ayudarte</p>
          <div><label>Nombre *</label><input type="text" id="v-name" placeholder="Tu nombre" /></div>
          <div><label>Correo</label><input type="email" id="v-email" placeholder="tu@correo.com" /></div>
          <button className="primary" onclick="startChat()">Iniciar chat</button>
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
            <input type="text" id="msg-input" placeholder="Escribe tu mensaje…" onkeydown="if(event.key==='Enter')sendMsg()" />
            <button id="send-btn" onclick="sendMsg()">Enviar</button>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          const APP_URL = '${appUrl}';
          const TOKEN = '${token}';
          const SB_URL = '${supabaseUrl}';
          const SB_KEY = '${supabaseKey}';
          let sessionId = null;
          let sb = null;
          let channel = null;

          async function startChat() {
            const name = document.getElementById('v-name').value.trim();
            if (!name) { alert('Por favor ingresa tu nombre'); return; }
            const email = document.getElementById('v-email').value.trim();

            const res = await fetch(APP_URL + '/api/chat/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-widget-token': TOKEN },
              body: JSON.stringify({ visitor_name: name, visitor_email: email || undefined })
            });
            if (!res.ok) { alert('Error al iniciar chat'); return; }
            const data = await res.json();
            sessionId = data.session_id;

            document.getElementById('intro').style.display = 'none';
            document.getElementById('chat-view').style.display = 'flex';

            // Subscribe to realtime messages
            sb = window.supabase.createClient(SB_URL, SB_KEY);
            channel = sb.channel('chat:' + sessionId)
              .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'chat_messages',
                filter: 'session_id=eq.' + sessionId
              }, (payload) => {
                const msg = payload.new;
                if (msg.sender_type !== 'visitor') {
                  appendMessage(msg.content, 'agent');
                  document.getElementById('status-text').textContent = 'Agente en línea';
                }
              })
              .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'chat_sessions',
                filter: 'id=eq.' + sessionId
              }, (payload) => {
                if (payload.new.status === 'active') {
                  document.getElementById('status-text').textContent = 'Agente en línea ●';
                } else if (payload.new.status === 'closed') {
                  document.getElementById('status-text').textContent = 'Chat cerrado';
                  document.getElementById('send-btn').disabled = true;
                }
              })
              .subscribe();
          }

          async function sendMsg() {
            const input = document.getElementById('msg-input');
            const content = input.value.trim();
            if (!content || !sessionId) return;
            input.value = '';
            appendMessage(content, 'visitor');

            await fetch(APP_URL + '/api/chat/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-widget-token': TOKEN },
              body: JSON.stringify({ session_id: sessionId, content })
            });
          }

          function appendMessage(text, type) {
            const el = document.createElement('div');
            el.className = 'msg ' + type;
            el.textContent = text;
            const msgs = document.getElementById('messages');
            msgs.appendChild(el);
            msgs.scrollTop = msgs.scrollHeight;
          }
        `}} />
      </body>
    </html>
  )
}
