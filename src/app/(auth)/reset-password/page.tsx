'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthPanel } from '@/components/auth/auth-panel'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)

    // The recovery callback established a session; updateUser sets the password.
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setBusy(false)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <AuthPanel
      title="Choose a new password"
      subtitle="Set a password to finish signing in."
      footer={<Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="password"
          placeholder="New password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={busy}
          className="h-11"
          autoComplete="new-password"
        />
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          disabled={busy}
          className="h-11"
          autoComplete="new-password"
        />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Update password'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </AuthPanel>
  )
}
