import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The one place an auth screen's top-level error or confirmation shows up. No
 * form in this folder is allowed to fail silently (the brief is explicit about
 * that), so every Server Action's `formError` lands here.
 */
export function FormMessage({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success'
  children: React.ReactNode
}) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-primary/25 bg-accent text-accent-foreground',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
