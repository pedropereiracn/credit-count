'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

export type ManufacturerOption = { id: string; name: string }

/**
 * Same "add new in the same submit" idea as ParkCombobox, plus one option
 * park does not need: a coaster's manufacturer may genuinely be unknown
 * (manufacturer_id is nullable; the dashboard views coalesce it to "Unknown"
 * per docs/TDD.md section 1). That is a real, explicit choice here, not the
 * absence of one.
 */
export function ManufacturerCombobox({
  manufacturers,
  defaultManufacturerId,
}: {
  manufacturers: ManufacturerOption[]
  defaultManufacturerId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'existing' | 'new' | 'unknown'>(
    defaultManufacturerId ? 'existing' : 'unknown',
  )
  const [selectedId, setSelectedId] = useState<string | null>(defaultManufacturerId ?? null)
  const [newName, setNewName] = useState('')

  const selected = manufacturers.find((m) => m.id === selectedId) ?? null
  const exactMatch = manufacturers.some((m) => m.name.toLowerCase() === query.trim().toLowerCase())

  return (
    <div className="space-y-1.5">
      <Label>Manufacturer</Label>
      <input type="hidden" name="manufacturer_mode" value={mode} />

      {mode === 'new' ? (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">New manufacturer</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                setMode(defaultManufacturerId ? 'existing' : 'unknown')
                setQuery('')
              }}
            >
              <X />
              <span className="sr-only">Cancel new manufacturer</span>
            </Button>
          </div>
          <Input
            name="manufacturer_new_name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Manufacturer name"
            aria-label="New manufacturer name"
            required
          />
        </div>
      ) : (
        <>
          {mode === 'existing' && <input type="hidden" name="manufacturer_id" value={selectedId ?? ''} />}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                {mode === 'unknown' ? (
                  <span className="text-muted-foreground">Unknown / not specified</span>
                ) : selected ? (
                  selected.name
                ) : (
                  <span className="text-muted-foreground">Search a manufacturer…</span>
                )}
                <ChevronsUpDown className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
              <Command>
                <CommandInput placeholder="Search manufacturers…" value={query} onValueChange={setQuery} />
                <CommandList>
                  <CommandEmpty>No manufacturer found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__unknown__"
                      onSelect={() => {
                        setMode('unknown')
                        setSelectedId(null)
                        setOpen(false)
                      }}
                    >
                      <Check className={cn('mr-1', mode === 'unknown' ? 'opacity-100' : 'opacity-0')} />
                      Unknown / not specified
                    </CommandItem>
                    {manufacturers.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={m.name}
                        onSelect={() => {
                          setMode('existing')
                          setSelectedId(m.id)
                          setOpen(false)
                        }}
                      >
                        <Check
                          className={cn('mr-1', m.id === selectedId && mode === 'existing' ? 'opacity-100' : 'opacity-0')}
                        />
                        {m.name}
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
                        <Plus /> Add new manufacturer &ldquo;{query.trim()}&rdquo;
                      </CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  )
}
