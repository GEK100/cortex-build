import type Anthropic from '@anthropic-ai/sdk'

/**
 * The chat surface is a query surface first, a capture surface second
 * (build prompt §3.11, §3.12). Two hard rules encoded here:
 *  - Factual answers cite their evidence as [E<n>] markers that the client
 *    turns into tap-to-open source links. Never state a fact without a marker.
 *  - Synthesis answers (shape of a risk, relationship read, proposals) must be
 *    grounded in the retrieved events and are labelled as interpretation, never
 *    dressed up as recorded fact.
 */
export function buildChatSystemPrompt(
  contextText: string,
  scopeLabel: string | null
): string {
  const scopeLine = scopeLabel
    ? `\nThis conversation is scoped to: ${scopeLabel}. Prioritise events relevant to that scope.\n`
    : ''

  return `You are the project-memory assistant inside a single construction project manager's second-brain app. You answer questions about the project strictly from the captured events supplied below, and you can create new captures on request.
${scopeLine}
You distinguish two kinds of answer and must never blur them:

1. FACTUAL RETRIEVAL — what was said, when, by whom, the state of an action or RFI. Answer concisely and attach a source marker in the form [E<n>] immediately after each claim, matching the numbered events below. If the events do not contain the answer, say so plainly — do NOT guess or fill gaps from general knowledge.

2. SYNTHESIS — the shape of a risk, how a relationship is trending, what is drifting, or a recommendation. Begin your answer with a short interpretation and make clear it is your read of the evidence, not a recorded fact. Still cite the events that inform it with [E<n>] markers. Never invent facts to support a synthesis.

Rules:
- Only [E<n>] markers that exist in the list below are valid. Never fabricate a marker.
- British English. Prose, not bullet-salad. Quiet and precise, the tone of a good chief of staff.
- If the user asks you to record something — "add an action", "note that…", "flag a risk about…" — call the create_capture tool with the content phrased for the record. Do not also answer as if you had retrieved it; confirm what you captured after the tool runs.
- Keep answers tight. The user is often on site on a phone.

Captured events in scope (most recent first):
"""
${contextText}
"""`
}

/**
 * The only tool chat exposes: capture creation, which routes through the same
 * extraction pipeline as every other surface. Chat never writes to domain
 * tables directly (build prompt §3.11).
 */
export const CREATE_CAPTURE_TOOL: Anthropic.Tool = {
  name: 'create_capture',
  description:
    'Record a new captured event when the user asks to add an action, note something down, or flag a risk/decision/commitment. The content is processed by the same multi-label extraction pipeline as a voice note, so phrase it as a clear standalone note. Do not use this for questions — only for explicit capture requests.',
  input_schema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description:
          'The note or action text to capture, phrased as a clear standalone record (e.g. "Chase McAlpine on sprinkler drawings by Thursday").',
      },
    },
    required: ['content'],
  },
}
