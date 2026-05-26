import { forwardRef, useId, type ReactNode } from 'react'
import * as RCheckbox from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps {
  label: ReactNode
  description?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  className?: string
  /** Bungkus seluruh row supaya bisa kasih flex-grow/shrink dari luar. */
  containerClassName?: string
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { label, description, checked, onCheckedChange, disabled, id: idProp, className, containerClassName },
  ref
) {
  const autoId = useId()
  const id = idProp ?? autoId

  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex items-start gap-2.5 cursor-pointer select-none',
        disabled && 'opacity-60 cursor-not-allowed',
        containerClassName
      )}
    >
      <RCheckbox.Root
        ref={ref}
        id={id}
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        disabled={disabled}
        className={cn(
          'mt-0.5 h-[18px] w-[18px] shrink-0 rounded-[4px] border bg-white transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1',
          'data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600',
          'data-[state=unchecked]:border-neutral-300 data-[state=unchecked]:hover:border-neutral-400',
          'disabled:cursor-not-allowed',
          className
        )}
      >
        <RCheckbox.Indicator className="flex items-center justify-center text-white">
          <Check className="h-3 w-3 animate-scale-in" strokeWidth={3.5} />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-body-sm text-neutral-800 leading-tight">{label}</span>
        {description && (
          <span className="text-caption text-neutral-500 leading-snug">{description}</span>
        )}
      </span>
    </label>
  )
})
