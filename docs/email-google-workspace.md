# Correo HexDesk sobre Google Workspace (soporte@fernandobolivar.app)

HexDesk usa **una sola cuenta** de Google Workspace para todo el correo:

- **Salida** (notificaciones de tickets, respuestas, cambios de estado, CSAT, reset de
  contraseña, reportes): vía **SMTP de Gmail** (`smtp.gmail.com`) autenticado con una
  **App Password**. Sale por los servidores de Google → SPF/DKIM/DMARC alineados solos.
- **Entrada** (email → ticket y respuestas → comentario): un **Google Apps Script** del
  buzón `soporte@` lee los correos nuevos y los envía al webhook `/api/email/inbound`.

No se requieren cambios de MX ni de DNS (más allá del DKIM estándar de Workspace).

---

> **Importante — `soporte@` es un ALIAS.** En este Workspace hay una sola cuenta con login
> (la principal). `soporte@fernandobolivar.app` es un alias que entra al buzón de esa cuenta.
> Por eso: el SMTP se autentica con la **cuenta principal** (que sí tiene App Password) y se
> envía *mostrando* el alias. El Apps Script corre en la **cuenta principal** (donde llega
> el correo del alias).

## 1. Variables de entorno (Vercel + `.env.local`)

```
GMAIL_USER=tucuenta@fernandobolivar.app     # cuenta PRINCIPAL con login (autentica el SMTP)
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx          # App Password de la cuenta principal (16 chars)
SUPPORT_EMAIL=soporte@fernandobolivar.app   # alias visible (remitente + respuestas)
MAIL_FROM="HexDesk <soporte@fernandobolivar.app>"
EMAIL_INBOUND_SECRET=<valor aleatorio, p.ej. openssl rand -hex 32>
```

## 2. Preparar la cuenta de Google

1. Confirmar que **soporte** existe como alias de la cuenta principal
   (Admin console → Directorio → Usuarios → tu usuario → *Información del usuario →
   Correos electrónicos alternativos*), o como alias de dominio.
2. Activar **Verificación en 2 pasos** en la **cuenta principal**.
3. Crear **App Password** en https://myaccount.google.com/apppasswords (logueado con la
   cuenta principal) → copiar el valor a `GMAIL_APP_PASSWORD`.
4. (Opcional) Si al enviar el remitente aparece como la cuenta principal en vez del alias,
   agrégalo en Gmail → Configuración → *Cuentas → Enviar como* → añadir
   `soporte@fernandobolivar.app` (para aliases de cuenta suele ser automático).
5. (Admin, recomendado) Activar **DKIM** en Admin console → Apps → Google Workspace →
   Gmail → *Authenticate email*.

## 3. Recepción: Google Apps Script

1. Ir a https://script.google.com → **Nuevo proyecto** (con la sesión de la **cuenta
   principal**, donde llega el correo de `soporte@`).
2. Pegar el código de `apps-script/hexdesk-inbound.gs` (abajo).
3. Ajustar las constantes `WEBHOOK_URL` y `INBOUND_SECRET`.
4. Ejecutar `processInbox` una vez y **autorizar** los permisos de Gmail.
5. Crear un **activador** (Triggers ⏰): función `processInbox`, *Time-driven* → *Minutes
   timer* → **cada 5 minutos**.

Cada correo nuevo en la bandeja de `soporte@` crea un ticket. Si es respuesta a una
notificación de HexDesk (asunto `[#123]` o alias `soporte+t...@`), se agrega como
comentario al ticket original y lo reabre si estaba cerrado.

### Código del Apps Script

```javascript
// hexdesk-inbound.gs — reenvía correos nuevos de soporte@ a HexDesk.
const WEBHOOK_URL = 'https://hexdesk.fernandobolivar.app/api/email/inbound';
const INBOUND_SECRET = 'PEGA_AQUI_EL_MISMO_EMAIL_INBOUND_SECRET';
const PROCESSED_LABEL = 'hexdesk-procesado';

function processInbox() {
  const label = getOrCreateLabel_(PROCESSED_LABEL);
  // Correos entrantes sin procesar (excluye lo enviado por nosotros).
  const threads = GmailApp.search('in:inbox is:unread -label:' + PROCESSED_LABEL, 0, 50);

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      if (!msg.isUnread()) return;
      try {
        const payload = {
          from: msg.getFrom(),
          subject: msg.getSubject() || '(sin asunto)',
          text: msg.getPlainBody(),
          to: msg.getTo(),
        };
        const res = UrlFetchApp.fetch(WEBHOOK_URL, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-webhook-secret': INBOUND_SECRET },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        });
        if (res.getResponseCode() === 200) {
          msg.markRead();
        } else {
          console.error('HexDesk ' + res.getResponseCode() + ': ' + res.getContentText());
        }
      } catch (e) {
        console.error('Error procesando mensaje: ' + e);
      }
    });
    thread.addLabel(label);
  });
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
```

---

## Cómo funciona el threading (respuestas → comentarios)

Cada notificación saliente lleva `Reply-To: soporte+t{uuid-del-ticket}@fernandobolivar.app`.
Gmail entrega los `+alias` al mismo buzón `soporte@`, y el alias queda en el header `To`
de la respuesta. El webhook detecta:

1. `+t{uuid}` en el destinatario → reconecta al ticket exacto.
2. `[#123]` en el asunto → reconecta por número de ticket (respaldo).

Si no hay ninguna señal, se crea un ticket nuevo.
