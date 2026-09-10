import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { CoasterForm } from '@/components/admin/coaster-form'
import type { ParkOption } from '@/components/admin/park-combobox'
import type { ManufacturerOption } from '@/components/admin/manufacturer-combobox'

export const metadata: Metadata = {
  title: 'Add coaster',
}

export const dynamic = 'force-dynamic'

export default async function NewCoasterPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>
}) {
  const { name } = await searchParams
  const supabase = await createClient()

  const [{ data: parks }, { data: manufacturers }] = await Promise.all([
    supabase.from('parks').select('id, name, country_code').order('name'),
    supabase.from('manufacturers').select('id, name').order('name'),
  ])

  return (
    <CoasterForm
      parks={(parks ?? []) as ParkOption[]}
      manufacturers={(manufacturers ?? []) as ManufacturerOption[]}
      initialName={name ?? ''}
    />
  )
}
