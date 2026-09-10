import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type BreakdownRow = { label: string; credits: number }

/**
 * A counted list, largest first (task 3). Every value here is a `credits` count
 * straight from one of the five views; this component only sorts and draws bars,
 * it never recomputes a total.
 */
export function BreakdownCard({
  title,
  rows,
  emptyMessage,
  className,
}: {
  title: string
  rows: BreakdownRow[]
  emptyMessage: string
  className?: string
}) {
  const sorted = [...rows].sort((a, b) => b.credits - a.credits || a.label.localeCompare(b.label))
  const max = sorted.reduce((m, r) => Math.max(m, r.credits), 0) || 1

  return (
    <Card className={cn('gap-3', className)}>
      <CardHeader>
        <CardTitle className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
        {sorted.map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-2 text-sm font-bold">
              <span className="truncate text-muted-foreground">{row.label}</span>
              <span className="font-heading tabular-nums text-foreground">{row.credits}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${row.credits === 0 ? 0 : Math.max(4, (row.credits / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
