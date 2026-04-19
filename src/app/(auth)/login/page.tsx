'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME, ALLOWED_EMAIL } from '@/lib/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  )
  const [message, setMessage] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
    } else {
      setStatus('sent')
      setMessage('Check your email for the login link.')
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          {APP_NAME}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to continue.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <Input
            type="email"
            placeholder={ALLOWED_EMAIL}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={status === 'sending' || status === 'sent'}
            className="h-10"
          />
          <Button
            type="submit"
            className="w-full"
            disabled={status === 'sending' || status === 'sent'}
          >
            {status === 'sending'
              ? 'Sending...'
              : status === 'sent'
                ? 'Link sent'
                : 'Send login link'}
          </Button>
        </form>

        {message && (
          <p
            className={`mt-4 text-sm ${
              status === 'error'
                ? 'text-destructive'
                : 'text-muted-foreground'
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </main>
  )
}
