import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CoasterForm, type CoasterDetail } from '@/components/admin/coaster-form'
import type { ParkOption } from '@/components/admin/park-combobox'
import type { ManufacturerOption } from '@/components/admin/manufacturer-combobox'
import type { MergeCandidate } from '@/components/admin/merge-dialog'

export const metadata: Metadata = {
  title: 'Edit coaster',
}

export const dynamic = 'force-dynamic'

export default async function EditCoasterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: coaster }, { data: parks }, { data: manufacturers }, { data: others }] = await Promise.all([
    supabase.from('coasters').select('id, name, track_type, retired_at, park_id, manufacturer_id').eq('id', id).maybeSingle(),
    supabase.from('parks').select('id, name, country_code').order('name'),
    supabase.from('manufacturers').select('id, name').order('name'),
    supabase.from('coasters').select('id, name, park:parks(name, country_code)').neq('id', id).order('name'),
  ])

  if (!coaster) {
    notFound()
  }

  const mergeCandidates: MergeCandidate[] = (
    (others ?? []) as unknown as { id: string; name: string; park: { name: string; country_code: string } | null }[]
  ).map((o) => ({
    id: o.id,
    name: o.name,
    parkName: o.park?.name ?? 'Unknown park',
    countryCode: o.park?.country_code ?? '',
  }))

  return (
    <CoasterForm
      coaster={coaster as CoasterDetail}
      parks={(parks ?? []) as ParkOption[]}
      manufacturers={(manufacturers ?? []) as ManufacturerOption[]}
      mergeCandidates={mergeCandidates}
    />
  )
}
