import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level fallback while the profile row and totals resolve (task 3).
 * `src/app/settings/page.tsx` has no internal Suspense boundary of its own
 * (it awaits both reads directly), so without this file a navigation to
 * `/settings` would otherwise show nothing until that Promise.all resolves.
 */
export default function SettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <Skeleton className="h-9 w-40" />

      <div className="mt-8 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-2 h-4 w-56" />
            <Skeleton className="mt-4 h-11 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
