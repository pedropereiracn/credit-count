import { RowsSkeleton } from '@/components/skeletons'
import { AboutCredits } from '@/components/leaderboard/about-credits'

/**
 * Route-level fallback for `/` (task 3). `page.tsx` already streams its own
 * `RowsSkeleton` fallback through an inner `<Suspense>`, but that only takes
 * over once the route's RSC payload starts arriving; this covers the moment
 * before that, on a hard navigation. Same header copy, so nothing reflows
 * when the real page swaps in. `AboutCredits` is static copy, no fetch of
 * its own, so it renders for real here rather than as another skeleton.
 */
export default function HomeLoading() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <section className="min-w-0">
        <header>
          <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">
            Public leaderboard
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Most credits
          </h1>
          <p className="mt-3 max-w-prose text-sm leading-relaxed font-semibold text-muted-foreground sm:text-base">
            A <span className="text-foreground">credit</span> is one coaster you have ridden
            at least once, however many times you ride it again. Ranked by credits, highest
            first; ties share a rank.
          </p>
        </header>

        <div className="mt-8">
          <RowsSkeleton rows={10} />
        </div>
      </section>

      <AboutCredits />
    </div>
  )
}
