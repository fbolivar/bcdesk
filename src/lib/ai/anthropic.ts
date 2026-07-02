/**
 * Helper server-side para llamar a Claude (Anthropic Messages API).
 * Usado por las funciones de IA de tickets (triage, similares, KB, resumen).
 */

const MODEL = 'claude-haiku-4-5-20251001'

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export async function aiComplete(system: string, prompt: string, maxTokens = 1024): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY no está configurado')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  return data?.content?.[0]?.text ?? ''
}

/** Igual que aiComplete pero parsea la respuesta como JSON. */
export async function aiJSON<T>(system: string, prompt: string, maxTokens = 1024): Promise<T> {
  const text = await aiComplete(
    `${system}\n\nIMPORTANTE: Responde ÚNICAMENTE con JSON válido, sin explicaciones ni bloques de código.`,
    prompt,
    maxTokens
  )
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  return JSON.parse(cleaned) as T
}
