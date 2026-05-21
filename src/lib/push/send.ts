import { createServiceClient } from '@/lib/supabase/service'

export async function sendPushToUser(userId: string, title: string, body: string, url = '/') {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:support@bcdesk.com'

  if (!vapidPublicKey || !vapidPrivateKey) return

  const supabase = createServiceClient()
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subscriptions?.length) return

  const payload = JSON.stringify({ title, body, url })

  await Promise.allSettled(subscriptions.map(async sub => {
    try {
      const { default: webpush } = await import('web-push')
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    } catch {
      // Subscription expired — remove it
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
  }))
}
