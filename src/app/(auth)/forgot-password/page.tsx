'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthPanel } from '@/components/auth/auth-panel'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    if (error) {
      setError(error.message)
      setBusy(false)
    } else {
      setSent(true)
      setBusy(false)
    }
  }

  return (
    <AuthPanel
      title="Reset password"
      subtitle={sent ? undefined : 'We’ll email you a link to set a new password.'}
      footer={<Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}
    >
      {sent ? (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>
            If an account exists for <span className="font-medium text-foreground">{email}</span>,
            a reset link is on its way. Follow it to choose a new password.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
            className="h-11"
            autoComplete="email"
          />
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      )}
    </AuthPanel>
  )
}
