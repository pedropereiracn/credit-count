import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { RowsSkeleton } from '@/components/skeletons'
import { CatalogueList, type CoasterListItem } from '@/components/admin/catalogue-list'

export const metadata: Metadata = {
  title: 'Catalogue',
  description: 'Add, edit, retire and merge coasters in the Credit Count catalogue.',
}

// Same reasoning as the leaderboard (src/app/page.tsx): an admin who just
// retired or merged a coaster must see that on the very next load, not a
// cached one.
export const dynamic = 'force-dynamic'

export default function AdminPage() {
  return (
    <Suspense fallback={<RowsSkeleton rows={8} />}>
      <AdminCatalogueSection />
    </Suspense>
  )
}

async function AdminCatalogueSection() {
  const supabase = await createClient()

  const [{ data: coasters }, { data: parks }, { data: manufacturers }] = await Promise.all([
    supabase
      .from('coasters')
      .select('id, name, track_type, retired_at, park:parks(id, name, country_code), manufacturer:manufacturers(id, name)')
      .order('name'),
    supabase.from('parks').select('id'),
    supabase.from('manufacturers').select('id'),
  ])

  return (
    <CatalogueList
      coasters={(coasters ?? []) as unknown as CoasterListItem[]}
      parkCount={parks?.length ?? 0}
      manufacturerCount={manufacturers?.length ?? 0}
    />
  )
}
