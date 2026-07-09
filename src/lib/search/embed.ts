/**
 * Generates an embedding for a piece of text via OpenAI text-embedding-3-small
 * (1536 dims — matches the pgvector column). Returns null on any failure so
 * callers can degrade to keyword-only search rather than blocking.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  const input = text.trim().slice(0, 8000)
  if (!input) return null

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input }),
    })
    if (!res.ok) {
      console.error('[embed] OpenAI error:', await res.text())
      return null
    }
    const data = await res.json()
    return data?.data?.[0]?.embedding ?? null
  } catch (err) {
    console.error('[embed] Request failed:', err)
    return null
  }
}
