'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    // Full reload so the server picks up the cleared session and middleware
    // redirects to /login.
    window.location.href = '/login'
  }

  return (
    <Button variant="outline" size="sm" onClick={signOut} disabled={busy}>
      <LogOut className="mr-1.5 h-4 w-4" />
      {busy ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}
