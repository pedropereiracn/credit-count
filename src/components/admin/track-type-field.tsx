'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TRACK_TYPE_LABELS } from '@/lib/format'

const TYPES = ['steel', 'wooden', 'hybrid'] as const

/** Closed set, matching the coasters_tipo_valido check constraint: a segmented control, not free text, so an invalid type is impossible to type in the first place. */
export function TrackTypeField({ defaultValue = 'steel' }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue)

  return (
    <div className="space-y-1.5">
      <Label>Track type</Label>
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <Button
            key={t}
            type="button"
            variant={value === t ? 'default' : 'outline'}
            size="sm"
            aria-pressed={value === t}
            onClick={() => setValue(t)}
          >
            {TRACK_TYPE_LABELS[t]}
          </Button>
        ))}
      </div>
      <input type="hidden" name="track_type" value={value} />
    </div>
  )
}
