import { createAdminClient } from '@/lib/supabase/admin'

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Sends a Web Push notification to every registered device for a user.
 * Expired subscriptions (404/410) are pruned. web-push is imported dynamically
 * so a missing VAPID config degrades to a no-op rather than a hard failure.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:gareth@ictusflow.com'
  if (!pub || !priv) {
    console.warn('[push] VAPID keys not configured — skipping')
    return 0
  }

  let webpush: typeof import('web-push')
  try {
    webpush = await import('web-push')
  } catch {
    console.warn('[push] web-push not installed — skipping')
    return 0
  }
  webpush.setVapidDetails(subject, pub, priv)

  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  let sent = 0
  for (const s of subs ?? []) {
    const row = s as { id: string; endpoint: string; p256dh: string; auth: string }
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(payload)
      )
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('id', row.id)
      } else {
        console.error('[push] send failed:', err)
      }
    }
  }
  return sent
}
