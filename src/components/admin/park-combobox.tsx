'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { countryName } from '@/lib/format'
import { cn } from '@/lib/utils'

export type ParkOption = { id: string; name: string; country_code: string }

/**
 * Combo box with an "add new" escape hatch: park and manufacturer both need
 * one, because a coaster form is the only place an admin is likely to notice
 * an unlisted park, and sending them to a second screen to add it costs the
 * one-form promise in AGENTS.md's A6 task 2. The new park's row is not
 * written until the whole coaster form submits (see park_mode in
 * src/app/admin/actions.ts), so cancelling the form never leaves an orphan
 * park behind.
 */
export function ParkCombobox({
  parks,
  defaultParkId,
}: {
  parks: ParkOption[]
  defaultParkId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [selectedId, setSelectedId] = useState<string | null>(defaultParkId ?? null)
  const [newName, setNewName] = useState('')
  const [newCountry, setNewCountry] = useState('')

  const selected = parks.find((p) => p.id === selectedId) ?? null
  const exactMatch = parks.some((p) => p.name.toLowerCase() === query.trim().toLowerCase())

  return (
    <div className="space-y-1.5">
      <Label>Park</Label>
      <input type="hidden" name="park_mode" value={mode} />

      {mode === 'new' ? (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">New park</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                setMode('existing')
                setQuery('')
              }}
            >
              <X />
              <span className="sr-only">Cancel new park</span>
            </Button>
          </div>
          <Input
            name="park_new_name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Park name"
            aria-label="New park name"
            required
          />
          <Input
            name="park_new_country"
            value={newCountry}
            onChange={(e) => setNewCountry(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="Country code, e.g. GB"
            aria-label="New park country code"
            maxLength={2}
            required
          />
          <p className="text-xs text-muted-foreground">ISO country code, two letters (GB, US…).</p>
        </div>
      ) : (
        <>
          <input type="hidden" name="park_id" value={selectedId ?? ''} />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                {selected ? (
                  <span>
                    {selected.name}{' '}
                    <span className="text-muted-foreground">({countryName(selected.country_code)})</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Search a park…</span>
                )}
                <ChevronsUpDown className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
              <Command>
                <CommandInput placeholder="Search parks…" value={query} onValueChange={setQuery} />
                <CommandList>
                  <CommandEmpty>No park found.</CommandEmpty>
                  <CommandGroup>
                    {parks.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.name}
                        onSelect={() => {
                          setSelectedId(p.id)
                          setOpen(false)
                        }}
                      >
                        <Check className={cn('mr-1', p.id === selectedId ? 'opacity-100' : 'opacity-0')} />
                        {p.name} <span className="ml-1 text-muted-foreground">({countryName(p.country_code)})</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {query.trim().length > 0 && !exactMatch && (
                    <CommandGroup>
                      <CommandItem
                        value={`__new__${query}`}
                        onSelect={() => {
                          setNewName(query.trim())
                          setMode('new')
                          setOpen(false)
                        }}
                      >
                        <Plus /> Add new park &ldquo;{query.trim()}&rdquo;
                      </CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">Not listed? Search, then pick &ldquo;Add new park&rdquo;.</p>
        </>
      )}
    </div>
  )
}
