'use client'

import { useState } from 'react'
import { Boxes, ArrowRight, Mic, Radar, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME, ALLOWED_EMAIL } from '@/lib/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
    } else {
      setStatus('sent')
      setMessage('Check your email for the sign-in link.')
    }
  }

  const busy = status === 'sending' || status === 'sent'

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
            <p className="mt-1 text-sm text-muted-foreground">Welcome back. Enter your email to continue.</p>

            <form onSubmit={handleLogin} className="mt-6 space-y-3">
              <Input
                type="email"
                placeholder={ALLOWED_EMAIL}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
                className="h-11"
              />
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Link sent' : (
                  <>
                    Send sign-in link
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {message && (
              <p className={`mt-4 text-sm ${status === 'error' ? 'text-destructive' : 'text-success'}`}>
                {message}
              </p>
            )}

            <p className="mt-6 border-t border-border pt-4 text-center text-[11px] text-muted-foreground">
              Protected workspace · access is restricted &amp; audited.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
