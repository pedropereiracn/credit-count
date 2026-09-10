import { CoasterMark } from '@/components/coaster-mark'

/**
 * Every list in this app has one of these. The SOW says the app "does not need to be
 * beautiful, but it should not feel like a prototype", and a blank screen with no
 * explanation is exactly what a prototype feels like.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <CoasterMark className="mb-4 h-8 w-auto text-muted-foreground/40" />
      <h2 className="font-heading text-xl font-bold">{title}</h2>
      {children && (
        <div className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
