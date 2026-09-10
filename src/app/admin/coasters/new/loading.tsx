import { CoasterFormSkeleton } from '@/components/admin/coaster-form-skeleton'

/** Route-level fallback while parks and manufacturers load for the comboboxes
 * (task 3): `page.tsx` awaits both directly, with no Suspense of its own. */
export default function NewCoasterLoading() {
  return <CoasterFormSkeleton />
}
