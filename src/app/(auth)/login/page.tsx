'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Boxes, ArrowRight, Mic, Radar, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME } from '@/lib/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GoogleButton } from '@/components/auth/google-button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('error')
    if (err === 'restricted') {
      setNotice('That account isn’t approved for access yet. Contact the owner for an invite.')
    } else if (err === 'auth_failed') {
      setNotice('That sign-in link was invalid or expired. Please try again.')
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setBusy(false)
    } else {
      // Full reload so the server picks up the new session cookie.
      window.location.href = '/'
    }
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        {/* Hero */}
        <section className="relative flex flex-1 flex-col justify-between px-6 pt-10 pb-6 lg:px-12 lg:py-16">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow">
              <Boxes className="h-5 w-5" strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground">
              {APP_NAME}
            </span>
          </div>

          <div className="my-10 lg:my-0">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.24em] text-primary">
              Site Intelligence, spoken
            </p>
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
              Every word on site,
              <br />
              <span className="text-gradient">captured &amp; understood.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
              Speak it once. Cortex transcribes, classifies, and files every RFI, risk,
              commitment and decision — so nothing on your projects slips.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { icon: Mic, label: 'Voice-first capture' },
              { icon: Radar, label: 'Auto-extraction' },
              { icon: ShieldCheck, label: 'Claims-defensible record' },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* Auth card */}
        <section className="flex flex-1 items-center justify-center px-6 pb-12 lg:px-12 lg:py-16">
          <div className="w-full max-w-sm animate-rise rounded-2xl border border-border bg-card/70 p-6 shadow-float backdrop-blur-xl sm:p-8">
            <h2 className="font-display text-2xl font-bold text-foreground">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Welcome back. Continue to your workspace.</p>

            {notice && (
              <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                {notice}
              </p>
            )}

            <div className="mt-6">
              <GoogleButton />
            </div>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
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
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
                className="h-11"
                autoComplete="current-password"
              />
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? 'Signing in…' : (
                  <>
                    Sign in
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

            <div className="mt-5 flex items-center justify-between text-xs">
              <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Create account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
