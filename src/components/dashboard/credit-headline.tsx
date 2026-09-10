import { plural } from '@/lib/format'

/**
 * Credits as the headline, total rides beside it (FR4, task 1). The number itself
 * always comes straight from `my_totals`: never computed here, per AGENTS.md's
 * "Never" for this agent.
 */
export function CreditHeadline({ credits, rides }: { credits: number; rides: number }) {
  return (
    <div>
      <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">
        Your credit count
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-3">
        {/* The prototype's number sits at 112px on a phone and 208px on desktop
            (its own clamp, in container units). This one was pinned to a 4.5rem
            floor and never got past 9rem, so on a phone the number people came
            here to see read smaller than the "Log a ride" card beside it. Raised
            to match: the credit count is the one thing this screen should not
            let you miss (task 7). */}
        <span className="credit-number text-[clamp(7rem,20vw,12.5rem)] text-primary">
          {credits}
        </span>
        <span className="font-heading text-3xl font-bold sm:text-4xl">
          {credits === 1 ? 'credit' : 'credits'}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-muted-foreground sm:text-base">
        {credits > 0
          ? `${plural(rides, 'ride')} logged in total.`
          : `${plural(rides, 'ride')} so far. The number moves when you ride something new.`}
      </p>
    </div>
  )
}
