/**
 * Minimal ambient declaration for the `web-push` package so the project
 * type-checks without the package's own types installed. The real package is a
 * runtime dependency (see package.json) and is imported dynamically.
 */
declare module 'web-push' {
  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void

  export interface PushSubscriptionShape {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }

  export function sendNotification(
    subscription: PushSubscriptionShape,
    payload?: string | Buffer,
    options?: Record<string, unknown>
  ): Promise<{ statusCode: number }>
}
