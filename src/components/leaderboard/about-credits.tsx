import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * The aside that turns a visitor into a sign-up: a CTA, then the two mechanics of
 * the board (why "credits" and not "rides", and why the list is short by design).
 *
 * When the viewer is already signed in, the call to action sends them to their
 * dashboard instead of to sign-up. Offering "create an account" to someone who has
 * one is the kind of small wrongness that makes a product feel unfinished.
 */
export function AboutCredits({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-24">
      <div className="rounded-2xl border border-border bg-foreground p-5 text-background shadow-[0_4px_0_var(--color-chart-5)]">
        <p className="text-xs font-bold tracking-wide text-primary uppercase">Count yours</p>
        <h2 className="mt-2 font-heading text-xl font-bold">Three taps per ride.</h2>
        <p className="mt-2 text-sm leading-relaxed text-background/75">
          Search the coaster, pick it, confirm. Your credits and rides add up on their own.
        </p>
        <Button asChild className="mt-4 min-h-11">
          <Link href={signedIn ? '/dashboard' : '/signup'}>
            {signedIn ? 'Back to your dashboard' : 'Start your count'}
          </Link>
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-bold">How the board works</h2>

        <div className="mt-3 border-t border-dashed border-border pt-3">
          <p className="font-heading text-sm font-bold">Credits, not rides</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A credit is one coaster you have ridden at least once. Riding it ten times is
            still one credit.
          </p>
        </div>

        <div className="mt-3 border-t border-dashed border-border pt-3">
          <p className="font-heading text-sm font-bold">Opt-in only</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nobody is listed until they switch it on. Only a display name and a credit count
            ever show here, never which coasters.
          </p>
        </div>
      </div>
    </aside>
  )
}
