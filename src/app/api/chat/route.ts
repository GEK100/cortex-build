import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { MODELS } from '@/lib/config'
import { retrieveContext } from '@/lib/chat/retrieve'
import { buildChatSystemPrompt, CREATE_CAPTURE_TOOL } from '@/lib/chat/prompt'
import { createEvent } from '@/lib/events/create'
import { writeAuditLog } from '@/lib/audit/log'
import type { ChatMessage } from '@/lib/db/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_TOOL_ROUNDS = 3

export async function POST(request: Request) {
  let supabase
  let userId: string
  try {
    supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)
    userId = user.id
  } catch (err) {
    if (err instanceof Response) return err
    return new Response('Internal server error', { status: 500 })
  }

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const history: ChatMessage[] = body.messages
  const scope = body.scope ?? {}
  const scopeLabel: string | null = scope.scopeLabel ?? null

  const retrieval = await retrieveContext(supabase, userId, {
    entityId: scope.entityId,
    eventId: scope.eventId,
    days: scope.days,
  })

  const system = buildChatSystemPrompt(retrieval.contextText, scopeLabel)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      // Citations up front so the client can resolve [E<n>] markers as text streams.
      send({
        type: 'meta',
        citations: retrieval.citations,
        eventCount: retrieval.eventCount,
        earliest: retrieval.earliest,
        days: scope.days ?? 30,
      })

      const messages: Anthropic.MessageParam[] = history.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      try {
        let round = 0
        while (round < MAX_TOOL_ROUNDS) {
          round++
          const turn = anthropic.messages.stream({
            model: MODELS.sonnet,
            max_tokens: 1500,
            system,
            tools: [CREATE_CAPTURE_TOOL],
            messages,
          })

          turn.on('text', (delta) => send({ type: 'text', text: delta }))

          const final = await turn.finalMessage()

          if (final.stop_reason !== 'tool_use') break

          // Execute every create_capture the model requested, through the
          // shared pipeline, then feed results back for the confirmation turn.
          messages.push({
            role: 'assistant',
            content: final.content as unknown as Anthropic.ContentBlockParam[],
          })
          const toolResults: Anthropic.ToolResultBlockParam[] = []

          for (const block of final.content) {
            if (block.type !== 'tool_use' || block.name !== 'create_capture') continue
            const input = block.input as { content?: string }
            const content = (input.content ?? '').trim()

            if (!content) {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: 'No content supplied; nothing captured.',
                is_error: true,
              })
              continue
            }

            try {
              const { event } = await createEvent(
                supabase!,
                userId,
                {
                  event_type: 'text',
                  raw_content: content,
                  source_device: 'chat',
                  source_metadata: { origin: 'chat' },
                },
                { trigger: 'inline' }
              )
              send({ type: 'capture', event_id: event.id, content })
              writeAuditLog({
                userId,
                action: 'chat.capture',
                tableName: 'events',
                recordId: event.id,
                afterData: { content },
              })
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Captured and queued for extraction (event ${event.id}).`,
              })
            } catch (e) {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Capture failed: ${e instanceof Error ? e.message : 'unknown error'}`,
                is_error: true,
              })
            }
          }

          messages.push({ role: 'user', content: toolResults })
        }

        send({ type: 'done' })
      } catch (err) {
        console.error('[chat] Stream error:', err)
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Chat failed',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  })
}
