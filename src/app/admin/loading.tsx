import { RowsSkeleton } from '@/components/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/** Route-level fallback for `/admin` (task 3), covering the moment before
 * `page.tsx`'s own inner `<Suspense>` fallback takes over (see the comment
 * on src/app/loading.tsx, which explains why both layers exist). */
export default function AdminLoading() {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">Admin</p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Catalogue</h1>
        </div>
        <Skeleton className="h-11 w-32" />
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-11 w-full sm:max-w-sm" />
      </div>
      <div className="mt-4">
        <RowsSkeleton rows={8} />
      </div>
    </div>
  )
}
