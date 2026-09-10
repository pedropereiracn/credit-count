import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Email and display-name fields share the same shape: a label, the input, an
 * optional help line when there is no error, and the error itself when there is.
 * A real error message here beats the browser's own validation bubble, so this
 * always renders inline rather than only relying on `required`/`type=email`.
 */
export function TextField({
  label,
  name,
  type = 'text',
  autoComplete,
  placeholder,
  defaultValue,
  helpText,
  error,
  required = true,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  placeholder?: string
  defaultValue?: string
  helpText?: string
  error?: string
  required?: boolean
}) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        className="h-11"
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {helpText && !error && <p className="text-xs font-medium text-muted-foreground">{helpText}</p>}
      {error && (
        <p id={errorId} className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
