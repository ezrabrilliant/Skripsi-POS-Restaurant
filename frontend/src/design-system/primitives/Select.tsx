/**
 * Select — pakai native <select> di mobile (UX picker iOS/Android jauh
 * lebih baik), Radix Popover di desktop untuk kustomisasi visual penuh.
 *
 * Implementasi sekarang sederhana: pakai native <select> di semua viewport.
 * Cukup untuk filter dropdown sederhana. Untuk autocomplete (vendor picker,
 * bank picker), pakai Combobox terpisah (bisa dibangun di Fase 2 saat butuh).
 */

import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[]
  label?: string
  error?: string
  helper?: string
  placeholder?: string
  hideLabel?: boolean
  containerClassName?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    options,
    label,
    error,
    helper,
    placeholder,
    hideLabel,
    containerClassName,
    className,
    id: idProp,
    disabled,
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
          className={cn('text-label text-neutral-700', hideLabel && 'sr-only')}
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
        <select
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full appearance-none bg-transparent px-3 pr-9 py-2.5 text-body text-neutral-900 outline-none',
            'disabled:cursor-not-allowed',
            className
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-neutral-400" />
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
