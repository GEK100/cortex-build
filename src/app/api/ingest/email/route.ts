import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOwnerUserId } from '@/lib/auth/owner'
import { createEvent } from '@/lib/events/create'

/**
 * Inbound email → one event (build prompt §capture 4). Called by an
 * inbound-parse provider (SendGrid Inbound Parse, Mailgun route, Postmark
 * inbound) forwarding mail sent to the dedicated intake address. Authenticated
 * by a shared secret, not a user session — this endpoint has no browser.
 *
 * Dedupe rides on the events.offline_id unique constraint, keyed by the email
 * Message-ID, so a provider retry never double-creates.
 */
export async function POST(request: Request) {
  const secret = process.env.EMAIL_INGEST_SECRET
  const provided =
    request.headers.get('x-cortex-ingest-secret') ||
    new URL(request.url).searchParams.get('secret')

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    // Some providers post multipart/form-data; accept that too.
    try {
      const form = await request.formData()
      payload = Object.fromEntries(form.entries())
    } catch {
      return NextResponse.json({ error: 'Unparseable body' }, { status: 400 })
    }
  }

  const from = str(payload.from) || str(payload.sender) || ''
  const subject = str(payload.subject) || '(no subject)'
  const bodyText =
    str(payload.text) ||
    str(payload.body_plain) ||
    str(payload['body-plain']) ||
    str(payload.plain) ||
    str(payload.body) ||
    ''
  const messageId =
    str(payload.messageId) ||
    str(payload.message_id) ||
    str(payload['Message-Id']) ||
    str(payload['message-id']) ||
    null

  if (!bodyText && subject === '(no subject)') {
    return NextResponse.json({ error: 'Empty email' }, { status: 400 })
  }

  // The raw event body is a faithful record of the email — subject, sender,
  // and body — since that whole thing is the claims-defensible evidence.
  const raw = `Subject: ${subject}\nFrom: ${from}\n\n${bodyText}`.trim()

  try {
    const ownerId = await resolveOwnerUserId()
    const admin = createAdminClient()

    const { event, deduped } = await createEvent(
      admin,
      ownerId,
      {
        event_type: 'email',
        raw_content: raw,
        captured_at: str(payload.date) ? new Date(str(payload.date)!).toISOString() : undefined,
        source_device: 'email',
        offline_id: messageId ? `email:${messageId}` : undefined,
        source_metadata: {
          origin: 'email',
          from,
          subject,
          message_id: messageId,
          to: str(payload.to) || null,
        },
      },
      { trigger: 'inline' }
    )

    return NextResponse.json(
      { event_id: event.id, deduped },
      { status: deduped ? 200 : 201 }
    )
  } catch (err) {
    console.error('[ingest/email] Error:', err)
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 })
  }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}
