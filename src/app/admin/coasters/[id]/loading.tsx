import { CoasterFormSkeleton } from '@/components/admin/coaster-form-skeleton'

/** Route-level fallback while the coaster, parks and manufacturers load
 * (task 3): `page.tsx` awaits all four reads directly, with no Suspense of
 * its own. */
export default function EditCoasterLoading() {
  return <CoasterFormSkeleton />
}
