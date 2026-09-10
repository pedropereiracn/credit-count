import { RowsSkeleton } from '@/components/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/** Route-level fallback for `/rides` (task 3), covering the moment before
 * `page.tsx`'s own inner `<Suspense>` fallback takes over (see the comment
 * on src/app/loading.tsx, which explains why both layers exist). */
export default function RidesLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">My rides</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Every ride, newest first.</p>
        </div>
        <Skeleton className="h-11 w-28" />
      </header>

      <div className="mt-8">
        <RowsSkeleton rows={8} />
      </div>
    </div>
  )
}
