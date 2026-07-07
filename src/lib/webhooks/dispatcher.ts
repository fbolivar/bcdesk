import { createServiceClient } from '@/lib/supabase/service'

/** Anti-SSRF: solo https hacia hosts públicos (bloquea loopback, metadata cloud y rangos privados). */
function isSafeWebhookUrl(raw: string): boolean {
  let u: URL
  try { u = new URL(raw) } catch { return false }
  if (u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false
  // Literales IP internas / link-local / metadata / privadas.
  if (/^(127\.|10\.|169\.254\.|192\.168\.|0\.)/.test(host)) return false
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return false
  if (host === '169.254.169.254' || host === 'metadata.google.internal') return false
  return true
}

export type WebhookEvent =
  | 'ticket.created'
  | 'ticket.resolved'
  | 'ticket.assigned'
  | 'ticket.escalated'
  | 'chat.new_session'

export async function dispatchWebhookEvent(event: WebhookEvent, payload: Record<string, unknown>) {
  const supabase = createServiceClient()

  const { data: integrations } = await supabase
    .from('webhook_integrations')
    .select('id, integration_type, webhook_url, events')
    .eq('is_active', true)
    .contains('events', [event])

  if (!integrations?.length) return

  const body = formatPayload(event, payload)

  await Promise.allSettled(
    integrations.map(async (integration) => {
      if (!isSafeWebhookUrl(integration.webhook_url)) return // bloquea SSRF a destinos internos

      const formatted = integration.integration_type === 'slack'
        ? formatSlack(event, payload)
        : integration.integration_type === 'teams'
        ? formatTeams(event, payload)
        : body

      const res = await fetch(integration.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formatted),
      })

      if (res.ok) {
        await supabase
          .from('webhook_integrations')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', integration.id)
      }
    })
  )
}

function formatPayload(event: string, payload: Record<string, unknown>) {
  return { event, timestamp: new Date().toISOString(), data: payload }
}

function formatSlack(event: string, payload: Record<string, unknown>) {
  const eventLabel: Record<string, string> = {
    'ticket.created': '🎫 Nuevo ticket creado',
    'ticket.resolved': '✅ Ticket resuelto',
    'ticket.assigned': '👤 Ticket asignado',
    'ticket.escalated': '⚠️ Ticket escalado',
    'chat.new_session': '💬 Nuevo chat en vivo',
  }
  return {
    text: eventLabel[event] ?? event,
    attachments: [{
      color: event.includes('escalated') ? '#EF4444' : event.includes('resolved') ? '#10B981' : '#1789FC',
      fields: Object.entries(payload).slice(0, 4).map(([title, value]) => ({
        title, value: String(value), short: true,
      })),
    }],
  }
}

function formatTeams(event: string, payload: Record<string, unknown>) {
  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    summary: event,
    themeColor: '3B82F6',
    title: event,
    sections: [{
      facts: Object.entries(payload).slice(0, 6).map(([name, value]) => ({ name, value: String(value) })),
    }],
  }
}
