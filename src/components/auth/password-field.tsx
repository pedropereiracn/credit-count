'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'

/** A password input with a show/hide toggle, since typing one blind twice (sign-up,
 * confirm) is the kind of friction a credit tracker does not need to add. */
export function PasswordField({
  label,
  labelExtra,
  name,
  autoComplete,
  placeholder,
  error,
  required = true,
}: {
  label: string
  labelExtra?: React.ReactNode
  name: string
  autoComplete: 'new-password' | 'current-password'
  placeholder?: string
  error?: string
  required?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelExtra}
      </div>
      <InputGroup>
        <InputGroupInput
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error && (
        <p id={errorId} className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
