'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setRetired } from '@/app/admin/actions'

/** Reversible, unlike delete and merge, so it needs no confirmation dialog: matches the prototype's direct toggle. */
export function RetireToggleButton({ id, name, retired }: { id: string; name: string; retired: boolean }) {
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const result = await setRetired(id, !retired)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(retired ? `"${name}" is operating again.` : `"${name}" retired. Existing credits stay.`)
    })
  }

  return (
    <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={toggle} disabled={pending}>
      {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
      {retired ? 'Reopen' : 'Retire'}
    </Button>
  )
}
