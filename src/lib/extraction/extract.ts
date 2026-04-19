import Anthropic from '@anthropic-ai/sdk'
import { extractionResultSchema, type ExtractionResult } from './ontology'
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildUserPrompt,
  buildPhotoUserPrompt,
} from './prompt'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ExtractionRunResult {
  parsed: ExtractionResult
  rawResponse: Record<string, unknown>
  tokensUsed: number
  latencyMs: number
  model: string
}

/**
 * Runs the Sonnet multi-label extraction pipeline on an event.
 * Fetches the event, builds the prompt, calls Anthropic, validates with Zod.
 */
export async function runExtraction(
  eventId: string
): Promise<ExtractionRunResult> {
  const supabase = createAdminClient()

  // Fetch the event
  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (error || !event) {
    throw new Error(`Event not found: ${eventId}`)
  }

  // Mark as processing
  await supabase
    .from('events')
    .update({ extraction_status: 'processing' })
    .eq('id', eventId)

  const model = 'claude-sonnet-4-20250514'
  const startMs = Date.now()

  // Build messages based on event type
  const messages: Anthropic.MessageParam[] = []

  if (event.event_type === 'photo') {
    // For photos, include image if we have a URL, plus any caption/OCR text
    const userContent: Anthropic.ContentBlockParam[] = []

    // If there's a photo URL in storage, fetch and include as base64
    if (event.photo_url) {
      try {
        const { data: urlData } = supabase.storage
          .from('captures')
          .getPublicUrl(event.photo_url)

        if (urlData?.publicUrl) {
          const imgRes = await fetch(urlData.publicUrl)
          if (imgRes.ok) {
            const buffer = await imgRes.arrayBuffer()
            const base64 = Buffer.from(buffer).toString('base64')
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg'

            userContent.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64,
              },
            })
          }
        }
      } catch (err) {
        console.error('[extract] Failed to fetch photo for OCR:', err)
      }
    }

    userContent.push({
      type: 'text',
      text: buildPhotoUserPrompt(
        event.photo_caption_raw || event.raw_content,
        event.ocr_text
      ),
    })

    messages.push({ role: 'user', content: userContent })
  } else {
    // Text or voice — straightforward text prompt
    const content = event.edited_content || event.raw_content
    if (!content) {
      throw new Error('Event has no content to extract from')
    }

    messages.push({
      role: 'user',
      content: buildUserPrompt(content, event.event_type),
    })
  }

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages,
  })

  const latencyMs = Date.now() - startMs

  // Parse the text response
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in extraction response')
  }

  // Strip markdown code fences if present
  let jsonStr = textBlock.text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const rawJson = JSON.parse(jsonStr)
  const parsed = extractionResultSchema.parse(rawJson)

  const tokensUsed =
    (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)

  return {
    parsed,
    rawResponse: rawJson,
    tokensUsed,
    latencyMs,
    model,
  }
}
