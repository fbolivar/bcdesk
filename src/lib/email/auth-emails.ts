import { sendEmail, APP_URL, mailConfigured } from './mailer'

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${APP_URL}/reset-password/${token}`

  // En dev sin SMTP configurado, registra el enlace para poder probar.
  // En producción NUNCA se loguea el token.
  if (!mailConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[password-reset] SMTP no configurado. Enlace para ${to}: ${link}`)
    }
    return
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
  <body style="margin:0;background:#F1F4F8;font-family:Arial,Helvetica,sans-serif;padding:40px 0">
    <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E6EBF2;border-radius:16px;padding:32px">
      <div style="width:44px;height:44px;border-radius:12px;background:#0B2545;color:#FFFFFF;font-weight:800;display:inline-flex;align-items:center;justify-content:center;font-size:18px;line-height:44px">FB</div>
      <div style="font-weight:700;font-size:18px;margin-top:10px"><span style="color:#0B2545">Hex</span><span style="color:#00D4AA">Desk</span></div>
      <h1 style="color:#0B2545;font-size:20px;margin:20px 0 8px">Restablece tu contraseña</h1>
      <p style="color:#5B6B7C;font-size:14px;line-height:1.5;margin:0 0 24px">
        Recibimos una solicitud para restablecer tu contraseña en HexDesk. Haz clic en el botón para crear una nueva. Este enlace expira en 1 hora.
      </p>
      <a href="${link}" style="display:inline-block;background:#1789FC;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:12px">Restablecer contraseña</a>
      <p style="color:#5B6B7C;font-size:12px;line-height:1.5;margin:24px 0 0">
        Si no solicitaste esto, ignora este correo. Tu contraseña no cambiará.
      </p>
      <p style="color:#94A3B8;font-size:11px;line-height:1.5;margin:24px 0 0;border-top:1px solid #E6EBF2;padding-top:16px">
        HexDesk · Fernando Bolívar Buitrago · Consultor en Ciberseguridad
      </p>
    </div>
  </body></html>`

  try {
    await sendEmail({
      to,
      subject: 'Restablece tu contraseña — HexDesk',
      html,
    })
  } catch (e) {
    console.error('[password-reset] Error al enviar email:', e)
  }
}
