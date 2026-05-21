import { createServiceClient } from '@/lib/supabase/service'

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
      color: event.includes('escalated') ? '#EF4444' : event.includes('resolved') ? '#10B981' : '#3B82F6',
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
