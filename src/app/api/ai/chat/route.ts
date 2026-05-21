import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  const supabase = createServiceClient()
  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')?.content ?? ''

  const { data: articles } = await supabase
    .from('kb_articles')
    .select('title, content, category')
    .eq('is_published', true)
    .or(`title.ilike.%${lastUserMsg.substring(0, 50)}%,content.ilike.%${lastUserMsg.substring(0, 50)}%`)
    .limit(3)

  const kbContext = (articles ?? []).length > 0
    ? `\n\nArtículos de conocimiento relevantes:\n${(articles ?? []).map(a => `- ${a.title}: ${a.content?.substring(0, 200)}`).join('\n')}`
    : ''

  const systemPrompt = `Eres el asistente virtual de soporte de BCDesk. Tu objetivo es ayudar a los usuarios a resolver sus dudas antes de abrir un ticket.
Responde siempre en español, de forma concisa y amable.
Si no puedes resolver el problema, sugiere al usuario que abra un ticket.${kbContext}`

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (!anthropicKey && !openrouterKey && !openaiKey) {
    return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 503 })
  }

  // Anthropic API — transforma el stream al formato OpenAI que usa el cliente
  if (anthropicKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    })

    if (!response.ok || !response.body) {
      const err = await response.text().catch(() => '')
      return new Response(JSON.stringify({ error: `Anthropic error: ${response.status} ${err}` }), { status: 502 })
    }

    // Convierte el stream de Anthropic al formato SSE compatible con OpenAI
    const transformedStream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (!data) continue
              try {
                const parsed = JSON.parse(data)
                if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                  const chunk = JSON.stringify({ choices: [{ delta: { content: parsed.delta.text } }] })
                  controller.enqueue(new TextEncoder().encode(`data: ${chunk}\n\n`))
                } else if (parsed.type === 'message_stop') {
                  controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
                }
              } catch {}
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(transformedStream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }

  // Fallback: OpenRouter o OpenAI
  const apiKey = openrouterKey ?? openaiKey!
  const baseUrl = openrouterKey ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'
  const model = openrouterKey ? 'anthropic/claude-haiku-4-5' : 'gpt-4o-mini'

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(openrouterKey ? { 'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? '' } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 512,
    }),
  })

  return new Response(response.body, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}
