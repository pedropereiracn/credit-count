import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shared shape for the two coaster-form loading states (task 3):
 * `/admin/coasters/new` and `/admin/coasters/[id]`, whose real forms
 * (`src/components/admin/coaster-form.tsx`) are the same layout either way.
 */
export function CoasterFormSkeleton() {
  return (
    <div>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-9 w-56" />

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <div className="flex gap-2">
              <Skeleton className="h-11 w-20" />
              <Skeleton className="h-11 w-20" />
              <Skeleton className="h-11 w-20" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <Skeleton className="h-11 w-32" />
        <Skeleton className="h-11 w-24" />
      </div>
    </div>
  )
}
