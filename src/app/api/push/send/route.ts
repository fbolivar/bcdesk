import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser } from '@/lib/auth/session'

interface PushPayload {
  userId: string
  title: string
  body: string
  url?: string
}

interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

export async function POST(req: NextRequest) {
  // Solo staff puede disparar push a otros usuarios (evita phishing/spam).
  const me = await getCurrentUser()
  if (!me || !['admin', 'agent'].includes(me.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { userId, title, body, url } = await req.json() as PushPayload

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL ?? 'mailto:support@bcfabric.co'

  if (
    !vapidPublic ||
    !vapidPrivate ||
    vapidPublic === 'placeholder_replace_with_real_key'
  ) {
    return NextResponse.json({ sent: 0, message: 'VAPID keys no configuradas' })
  }

  try {
    const webpush = await import('web-push').catch(() => null)
    if (!webpush) {
      return NextResponse.json({ sent: 0, message: 'web-push no disponible' })
    }

    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate)

    let sent = 0
    const expired: string[] = []

    for (const sub of subs as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url: url ?? '/' })
        )
        sent++
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode
        // 410 Gone = suscripción expirada, limpiar
        if (code === 410 || code === 404) {
          expired.push(sub.endpoint)
        }
      }
    }

    // Limpiar suscripciones expiradas
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expired)
    }

    return NextResponse.json({ sent })
  } catch {
    return NextResponse.json({ sent: 0, message: 'Error enviando notificaciones' })
  }
}
