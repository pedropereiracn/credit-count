import Link from 'next/link'
import { CoasterMark } from '@/components/coaster-mark'

/**
 * The one wrapper every screen in `src/app/(auth)` sits inside: a centred card
 * that matches `#/login` and `#/signup` in the approved prototype (mark, heading,
 * lead line, card, footer). The root layout already centres its own max-w-5xl
 * column, so this only narrows further, it does not re-lay the page out.
 */
export function AuthShell({
  heading,
  lead,
  children,
  footer,
}: {
  heading: string
  lead: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-md py-4 sm:py-10">
      <Link href="/" className="mb-5 inline-flex items-center gap-2 text-primary" aria-label="Credit Count home">
        <CoasterMark className="h-10 w-auto" />
      </Link>
      <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">{heading}</h1>
      <p className="mt-1.5 text-base font-semibold text-muted-foreground">{lead}</p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">{children}</div>

      {footer && <p className="mt-5 text-center text-sm font-bold text-muted-foreground">{footer}</p>}
    </div>
  )
}
