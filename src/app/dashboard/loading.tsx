import { HeadlineSkeleton, RowsSkeleton, StatCardSkeleton } from '@/components/skeletons'

/** Route-level fallback while the dashboard's parallel reads resolve. */
export default function DashboardLoading() {
  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <HeadlineSkeleton />
        <HeadlineSkeleton />
      </section>
      <section className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <StatCardSkeleton />
        </div>
        <div className="lg:col-span-5">
          <StatCardSkeleton />
        </div>
        <div className="lg:col-span-4">
          <StatCardSkeleton />
        </div>
        <div className="lg:col-span-4">
          <StatCardSkeleton />
        </div>
        <div className="lg:col-span-8">
          <RowsSkeleton rows={5} />
        </div>
      </section>
    </div>
  )
}
