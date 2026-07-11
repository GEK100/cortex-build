'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GoogleButton } from '@/components/auth/google-button'
import { AuthPanel } from '@/components/auth/auth-panel'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setBusy(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }

    // If email confirmation is disabled, a session is returned → straight in.
    if (data.session) {
      window.location.href = '/'
      return
    }
    // Otherwise a confirmation email was sent.
    setSent(true)
    setBusy(false)
  }

  if (sent) {
    return (
      <AuthPanel
        title="Confirm your email"
        subtitle="Almost there."
        footer={<Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}
      >
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>
            We&apos;ve sent a confirmation link to{' '}
            <span className="font-medium text-foreground">{email}</span>. Click it to activate your
            account, then sign in.
          </p>
        </div>
      </AuthPanel>
    )
  }

  return (
    <AuthPanel
      title="Create account"
      subtitle="Start capturing your projects."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton label="Sign up with Google" />

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSignup} className="space-y-3">
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
        <Input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={busy}
          className="h-11"
          autoComplete="new-password"
        />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Creating…' : (
            <>
              Create account
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </AuthPanel>
  )
}
