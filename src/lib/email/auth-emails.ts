import { sendEmail, APP_URL, mailConfigured } from './mailer'

/**
 * Correo de bienvenida al portal (formato corporativo HexDesk). Se envía cuando
 * el admin da de alta / actualiza a un usuario y activa la opción. Copia opcional
 * al admin (cc) para poder ver el mensaje enviado.
 */
export async function sendWelcomeEmail(opts: { to: string; name: string; cc?: string }) {
  const { to, name, cc } = opts
  const link = `${APP_URL}/login`
  const firstName = (name || '').trim().split(/\s+/)[0] || ''

  if (!mailConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[welcome] SMTP no configurado. Bienvenida para ${to} (portal: ${link})`)
    }
    return { ok: false as const, reason: 'smtp' }
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#F1F4F8;font-family:Arial,Helvetica,sans-serif;padding:40px 12px">
    <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E6EBF2;border-radius:18px;overflow:hidden">
      <div style="background:linear-gradient(150deg,#0B2545 0%,#12385c 100%);padding:34px 36px">
        <div style="display:inline-flex;align-items:center;gap:10px">
          <div style="width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.06);border:2px solid #00D4AA;color:#00D4AA;font-weight:800;text-align:center;line-height:38px;font-size:18px">✓</div>
          <div>
            <div style="font-weight:800;font-size:20px;color:#fff;letter-spacing:-.4px"><span style="color:#fff">Hex</span><span style="color:#00D4AA">Desk</span></div>
            <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#9db6cf;margin-top:2px">Mesa de ayuda · Ciberseguridad</div>
          </div>
        </div>
      </div>
      <div style="padding:34px 36px">
        <p style="color:#00D4AA;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin:0 0 6px">Te damos la bienvenida</p>
        <h1 style="color:#0B2545;font-size:23px;line-height:1.25;margin:0 0 14px">${firstName ? `¡Hola, ${firstName}! ` : ''}Ya tienes acceso a tu portal</h1>
        <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 14px">
          Es un gusto darte la bienvenida a <b>HexDesk</b>, tu portal de soporte y monitoreo. Desde aquí podrás
          abrir y seguir tus solicitudes, ver el estado de tus equipos, consultar tus contratos y facturas, y
          comunicarte con nuestro equipo — todo en un solo lugar, disponible 24/7.
        </p>
        <div style="text-align:center;margin:26px 0 22px">
          <a href="${link}" style="display:inline-block;background:#00D4AA;color:#0B2545;text-decoration:none;font-size:15px;font-weight:700;padding:13px 30px;border-radius:12px">Ingresar al portal →</a>
        </div>
        <div style="background:#F4F7FB;border:1px solid #E6EBF2;border-radius:12px;padding:16px 18px;margin:0 0 8px">
          <p style="color:#5B6B7C;font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Tus datos de acceso</p>
          <p style="color:#0B2545;font-size:14px;margin:0 0 4px"><b>Portal:</b> ${APP_URL.replace(/^https?:\/\//, '')}</p>
          <p style="color:#0B2545;font-size:14px;margin:0"><b>Usuario:</b> ${to}</p>
          <p style="color:#5B6B7C;font-size:12.5px;margin:10px 0 0;line-height:1.5">Si aún no tienes contraseña o la olvidaste, usa <b>“¿Olvidaste tu contraseña?”</b> en la pantalla de ingreso para crearla.</p>
        </div>
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:18px 0 0">
          Estamos para acompañarte. Si necesitas ayuda para empezar, responde este correo o abre un ticket desde el portal. ¡Bienvenida(o) a bordo!
        </p>
        <p style="color:#0B2545;font-size:14px;line-height:1.5;margin:18px 0 0">
          Cordialmente,<br/><b>Fernando Bolívar Buitrago</b><br/>
          <span style="color:#5B6B7C;font-size:13px">Consultor en Ciberseguridad · HexDesk</span>
        </p>
        <p style="color:#94A3B8;font-size:11px;line-height:1.5;margin:26px 0 0;border-top:1px solid #E6EBF2;padding-top:16px">
          HexDesk · Fernando Bolívar Buitrago · Consultor en Ciberseguridad<br/>
          Este mensaje se envió porque se habilitó tu acceso al portal.
        </p>
      </div>
    </div>
  </body></html>`

  try {
    await sendEmail({
      to,
      ...(cc && cc.toLowerCase() !== to.toLowerCase() ? { cc } : {}),
      subject: '¡Bienvenido(a) a HexDesk! · Acceso a tu portal',
      html,
    })
    return { ok: true as const }
  } catch (e) {
    console.error('[welcome] Error al enviar email:', e)
    return { ok: false as const, reason: 'send' }
  }
}

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
      <a href="${link}" style="display:inline-block;background:#00D4AA;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:12px">Restablecer contraseña</a>
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
