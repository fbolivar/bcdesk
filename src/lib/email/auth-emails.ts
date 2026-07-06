import { resend, FROM_EMAIL, APP_URL } from './resend'

function hasRealResendKey(): boolean {
  const k = process.env.RESEND_API_KEY
  return Boolean(k && k.startsWith('re_'))
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${APP_URL}/reset-password/${token}`

  // En dev sin Resend configurado, registra el enlace para poder probar.
  // En producción NUNCA se loguea el token.
  if (!hasRealResendKey()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[password-reset] Resend no configurado. Enlace para ${to}: ${link}`)
    }
    return
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
  <body style="margin:0;background:#EEF1F6;font-family:Arial,Helvetica,sans-serif;padding:40px 0">
    <div style="max-width:480px;margin:0 auto;background:#0B1220;border:1px solid #FFFFFF;border-radius:16px;padding:32px">
      <div style="width:44px;height:44px;border-radius:12px;background:#12D9A0;color:#0F2540;font-weight:800;display:inline-flex;align-items:center;justify-content:center;font-size:22px;line-height:44px">&#10003;</div>
      <div style="font-weight:700;font-size:18px;margin-top:10px;color:#0F172A"><span style="color:#64748B">Hex</span><span style="color:#10C08E">Desk</span></div>
      <h1 style="color:#1E293B;font-size:20px;margin:20px 0 8px">Restablece tu contraseña</h1>
      <p style="color:#64748B;font-size:14px;line-height:1.5;margin:0 0 24px">
        Recibimos una solicitud para restablecer tu contraseña en HexDesk. Haz clic en el botón para crear una nueva. Este enlace expira en 1 hora.
      </p>
      <a href="${link}" style="display:inline-block;background:#4F8AFF;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:12px">Restablecer contraseña</a>
      <p style="color:#64748B;font-size:12px;line-height:1.5;margin:24px 0 0">
        Si no solicitaste esto, ignora este correo. Tu contraseña no cambiará.
      </p>
    </div>
  </body></html>`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Restablece tu contraseña — HexDesk',
      html,
    })
  } catch (e) {
    console.error('[password-reset] Error al enviar email:', e)
  }
}
