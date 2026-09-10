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
        <span className="credit-number text-[clamp(4.5rem,16vw,9rem)] text-primary">
          {credits}
        </span>
        <span className="font-heading text-2xl font-bold sm:text-3xl">
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
