import { cn } from '@/lib/utils'

/**
 * Consistent page header used across all surfaces: a mono green eyebrow, a
 * Bricolage display title, an optional subtitle, and an optional right-aligned
 * action slot.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
  className,
}: {
  title: string
  subtitle?: string
  eyebrow?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="truncate font-display text-2xl font-bold text-foreground md:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Standard centred page container with a staggered reveal. */
export function PageShell({
  children,
  size = 'default',
  className,
}: {
  children: React.ReactNode
  size?: 'narrow' | 'default' | 'wide'
  className?: string
}) {
  const max = size === 'wide' ? 'max-w-6xl' : size === 'narrow' ? 'max-w-2xl' : 'max-w-4xl'
  return (
    <div className={cn('mx-auto animate-rise px-4 py-6 md:px-6', max, className)}>{children}</div>
  )
}
