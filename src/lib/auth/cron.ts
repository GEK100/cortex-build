/**
 * Guards the scheduled-agent endpoints. Vercel Cron is configured to send the
 * CRON_SECRET as a Bearer token; we also accept an x-cron-secret header for
 * manual triggering. Throws a Response (401) that the route's catch re-returns,
 * matching the assertAuthorisedUser pattern.
 */
export function assertCronRequest(request: Request): void {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Fail closed: without a configured secret, no external trigger is trusted.
    throw new Response('Cron not configured', { status: 503 })
  }
  const authHeader = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-cron-secret')
  if (authHeader === `Bearer ${secret}` || cronHeader === secret) return
  throw new Response('Unauthorised', { status: 401 })
}
