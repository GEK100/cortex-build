import Link from 'next/link'
import { Boxes } from 'lucide-react'
import { APP_NAME } from '@/lib/config'

/** Centred branded auth card on the cockpit background (signup/forgot/reset). */
export function AuthPanel({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm animate-rise">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow">
            <Boxes className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground">
            {APP_NAME}
          </span>
        </Link>
        <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-float backdrop-blur-xl sm:p-8">
          <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-xs text-muted-foreground">{footer}</div>}
      </div>
    </main>
  )
}
