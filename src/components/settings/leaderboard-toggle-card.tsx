'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { setLeaderboardVisibility } from '@/app/settings/actions'
import { plural } from '@/lib/format'

/**
 * The state, written out as a sentence a person actually reads, never only the
 * switch position (AGENTS.md, A5, task 6). The switch flips immediately on
 * change, optimistically, and reverts itself if the write fails; there is no
 * separate Save button, so failure is reported as a toast rather than an inline
 * message nobody would see next to a control that already moved.
 */
export function LeaderboardToggleCard({
  initialVisible,
  displayName,
  credits,
}: {
  initialVisible: boolean
  displayName: string
  credits: number
}) {
  const [visible, setVisible] = useState(initialVisible)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleChange(checked: boolean) {
    setVisible(checked)
    setError(null)
    startTransition(async () => {
      const result = await setLeaderboardVisibility(checked)
      if (result.error) {
        setVisible(!checked)
        setError(result.error)
        toast.error(result.error)
        return
      }
      toast.success(
        checked
          ? 'You are now on the public leaderboard.'
          : 'You are now hidden from the public leaderboard.',
      )
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="font-heading text-lg font-bold">Public leaderboard</h2>

      <p className="mt-2 text-sm leading-relaxed font-semibold text-muted-foreground">
        {visible ? (
          <>
            You are <span className="text-foreground">listed</span> on the public leaderboard as{' '}
            <span className="text-foreground">{displayName}</span> with{' '}
            <span className="text-foreground">{plural(credits, 'credit')}</span>. Only your name
            and credit count are shown, never which coasters you rode.
          </>
        ) : (
          <>
            You are <span className="text-foreground">hidden</span> from the public leaderboard.
            Nobody can see your name or your credit count.
          </>
        )}
      </p>

      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      <div className="mt-4">
        <Switch
          checked={visible}
          onCheckedChange={handleChange}
          disabled={pending}
          aria-label="Appear on the public leaderboard"
        />
      </div>
    </div>
  )
}
