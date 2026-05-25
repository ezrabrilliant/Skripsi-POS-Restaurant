import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /** Hide visual label (still accessible to screen readers). */
  hideLabel?: boolean
  /** Wrapper class (outer, e.g. for grid layout). */
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helper,
    leftIcon,
    rightIcon,
    hideLabel,
    containerClassName,
    className,
    id: idProp,
    disabled,
    type = 'text',
    ...rest
  },
  ref
) {
  const autoId = useId()
  const id = idProp ?? autoId
  const helperId = `${id}-helper`
  const errorId = `${id}-error`
  const describedBy = [helper && helperId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label
          htmlFor={id}
          className={cn(
            'text-label text-neutral-700',
            hideLabel && 'sr-only'
          )}
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          'relative inline-flex items-center w-full rounded-md border bg-white transition-colors',
          'focus-within:ring-2 focus-within:ring-primary-500/30',
          error
            ? 'border-danger-400 focus-within:border-danger-500'
            : 'border-neutral-300 focus-within:border-primary-500',
          disabled && 'bg-neutral-50 opacity-60 cursor-not-allowed'
        )}
      >
        {leftIcon && (
          <span className="pl-3 text-neutral-400 [&_svg]:h-4 [&_svg]:w-4 shrink-0">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type={type}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full bg-transparent px-3 py-2.5 text-body text-neutral-900 placeholder:text-neutral-400 outline-none',
            'disabled:cursor-not-allowed',
            leftIcon && 'pl-2',
            rightIcon && 'pr-2',
            className
          )}
          {...rest}
        />
        {rightIcon && (
          <span className="pr-3 text-neutral-400 [&_svg]:h-4 [&_svg]:w-4 shrink-0">
            {rightIcon}
          </span>
        )}
      </div>
      {helper && !error && (
        <p id={helperId} className="text-caption text-neutral-500">
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-caption text-danger-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})
