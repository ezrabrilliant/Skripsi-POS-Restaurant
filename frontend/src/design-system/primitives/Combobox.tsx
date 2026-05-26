/**
 * Combobox - dropdown searchable berbasis Radix Popover + cmdk command list.
 * Pengganti native <select> untuk picker yang butuh typeahead atau lebih
 * dari ~5 opsi. Konsisten cross-OS (popover render sama Windows/Android/iOS).
 *
 * Variants:
 * - Combobox: value harus salah satu dari options.
 * - ComboboxFree: user boleh ketik nilai baru di luar options (free-text + suggestions).
 */

import { useId, useState, useMemo, type ReactNode } from 'react'
import * as RPopover from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  disabled?: boolean
  /** Subtitle kecil di bawah label (mis. unit, kategori). */
  helper?: string
}

interface BaseProps {
  label?: string
  hideLabel?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  options: ComboboxOption[]
  error?: string
  helper?: string
  disabled?: boolean
  containerClassName?: string
  className?: string
  /** Render trigger sebagai inline-block (default block w-full). */
  inline?: boolean
}

export interface ComboboxProps extends BaseProps {
  value: string
  onValueChange: (value: string) => void
}

export interface ComboboxFreeProps extends BaseProps {
  value: string
  onValueChange: (value: string) => void
  /** Label tombol "Tambahkan ___" untuk free-text. Default: "Pakai" */
  addLabel?: string
}

function Field({
  label,
  hideLabel,
  error,
  helper,
  containerClassName,
  id,
  children,
}: {
  label?: string
  hideLabel?: boolean
  error?: string
  helper?: string
  containerClassName?: string
  id: string
  children: ReactNode
}) {
  const helperId = `${id}-helper`
  const errorId = `${id}-error`
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
      {children}
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
}

function Trigger({
  id,
  open,
  disabled,
  error,
  inline,
  className,
  display,
  placeholder,
  describedBy,
}: {
  id: string
  open: boolean
  disabled?: boolean
  error?: string
  inline?: boolean
  className?: string
  display: ReactNode
  placeholder?: string
  describedBy?: string
}) {
  return (
    <RPopover.Trigger asChild>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-md border bg-white px-3 py-2.5',
          'text-body text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-500',
          error
            ? 'border-danger-400 focus-visible:border-danger-500'
            : 'border-neutral-300 hover:border-neutral-400',
          'disabled:bg-neutral-50 disabled:opacity-60 disabled:cursor-not-allowed',
          !inline && 'w-full',
          className
        )}
      >
        <span className={cn('truncate min-w-0 flex-1', !display && 'text-neutral-400')}>
          {display ?? placeholder ?? 'Pilih...'}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      </button>
    </RPopover.Trigger>
  )
}

function PopoverContent({
  children,
  matchTriggerWidth = true,
}: {
  children: ReactNode
  matchTriggerWidth?: boolean
}) {
  return (
    <RPopover.Portal>
      <RPopover.Content
        align="start"
        sideOffset={4}
        collisionPadding={8}
        style={{ zIndex: 50 }}
        className={cn(
          'rounded-md border border-neutral-200 bg-white shadow-lg overflow-hidden origin-top',
          'animate-scale-in',
          matchTriggerWidth && 'w-[var(--radix-popover-trigger-width)]',
          'min-w-[200px]'
        )}
      >
        {children}
      </RPopover.Content>
    </RPopover.Portal>
  )
}

export function Combobox({
  label,
  hideLabel,
  placeholder,
  searchPlaceholder = 'Cari...',
  emptyText = 'Tidak ditemukan',
  options,
  value,
  onValueChange,
  error,
  helper,
  disabled,
  containerClassName,
  className,
  inline,
}: ComboboxProps) {
  const autoId = useId()
  const id = autoId
  const [open, setOpen] = useState(false)

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])
  const describedBy = [helper && `${id}-helper`, error && `${id}-error`].filter(Boolean).join(' ') || undefined

  return (
    <Field
      label={label}
      hideLabel={hideLabel}
      error={error}
      helper={helper}
      containerClassName={containerClassName}
      id={id}
    >
      <RPopover.Root open={open} onOpenChange={setOpen}>
        <Trigger
          id={id}
          open={open}
          disabled={disabled}
          error={error}
          inline={inline}
          className={className}
          display={selected?.label}
          placeholder={placeholder}
          describedBy={describedBy}
        />
        <PopoverContent>
          <Command
            filter={(itemValue, search) => {
              if (!search) return 1
              return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }}
          >
            <div className="flex items-center border-b border-neutral-200 px-3">
              <Command.Input
                placeholder={searchPlaceholder}
                className="flex h-10 w-full bg-transparent text-body-sm placeholder:text-neutral-400 outline-none"
              />
            </div>
            <Command.List className="max-h-[260px] overflow-y-auto p-1">
              <Command.Empty className="py-6 text-center text-body-sm text-neutral-500">
                {emptyText}
              </Command.Empty>
              {options.map((opt) => (
                <Command.Item
                  key={opt.value}
                  value={`${opt.label} ${opt.value}`}
                  disabled={opt.disabled}
                  onSelect={() => {
                    onValueChange(opt.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-sm px-2.5 py-2 text-body-sm cursor-pointer outline-none',
                    'data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-900',
                    'data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed'
                  )}
                >
                  <span className="flex flex-col min-w-0">
                    <span className="truncate text-neutral-900">{opt.label}</span>
                    {opt.helper && (
                      <span className="truncate text-caption text-neutral-500">{opt.helper}</span>
                    )}
                  </span>
                  {value === opt.value && (
                    <Check className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                  )}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverContent>
      </RPopover.Root>
    </Field>
  )
}

/**
 * ComboboxFree - sama dengan Combobox tapi user boleh pakai nilai bebas
 * (tidak harus salah satu dari options). Berguna untuk bank picker, vendor
 * baru, dll yang butuh suggestion + free-text.
 */
export function ComboboxFree({
  label,
  hideLabel,
  placeholder,
  searchPlaceholder = 'Cari atau ketik baru...',
  emptyText = 'Belum ada saran',
  options,
  value,
  onValueChange,
  error,
  helper,
  disabled,
  containerClassName,
  className,
  inline,
  addLabel = 'Pakai',
}: ComboboxFreeProps) {
  const autoId = useId()
  const id = autoId
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const exactMatch = useMemo(
    () => options.find((o) => o.label.toLowerCase() === search.toLowerCase()),
    [options, search]
  )

  const display = value || undefined
  const describedBy = [helper && `${id}-helper`, error && `${id}-error`].filter(Boolean).join(' ') || undefined

  const handleSelect = (v: string) => {
    onValueChange(v)
    setSearch('')
    setOpen(false)
  }

  return (
    <Field
      label={label}
      hideLabel={hideLabel}
      error={error}
      helper={helper}
      containerClassName={containerClassName}
      id={id}
    >
      <RPopover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch('') }}>
        <Trigger
          id={id}
          open={open}
          disabled={disabled}
          error={error}
          inline={inline}
          className={className}
          display={display}
          placeholder={placeholder}
          describedBy={describedBy}
        />
        <PopoverContent>
          <Command
            filter={(itemValue, q) => {
              if (!q) return 1
              return itemValue.toLowerCase().includes(q.toLowerCase()) ? 1 : 0
            }}
          >
            <div className="flex items-center border-b border-neutral-200 px-3">
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder={searchPlaceholder}
                className="flex h-10 w-full bg-transparent text-body-sm placeholder:text-neutral-400 outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && search.trim() && !exactMatch) {
                    e.preventDefault()
                    handleSelect(search.trim())
                  }
                }}
              />
            </div>
            <Command.List className="max-h-[260px] overflow-y-auto p-1">
              {search.trim() && !exactMatch && (
                <Command.Item
                  value={`__add__ ${search}`}
                  onSelect={() => handleSelect(search.trim())}
                  className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-body-sm cursor-pointer outline-none data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-900"
                >
                  <span className="text-primary-700">{addLabel}</span>
                  <span className="truncate font-medium text-neutral-900">"{search.trim()}"</span>
                </Command.Item>
              )}
              {options.length === 0 && !search.trim() && (
                <Command.Empty className="py-6 text-center text-body-sm text-neutral-500">
                  {emptyText}
                </Command.Empty>
              )}
              {options.map((opt) => (
                <Command.Item
                  key={opt.value}
                  value={`${opt.label} ${opt.value}`}
                  disabled={opt.disabled}
                  onSelect={() => handleSelect(opt.value)}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-sm px-2.5 py-2 text-body-sm cursor-pointer outline-none',
                    'data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-900',
                    'data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed'
                  )}
                >
                  <span className="flex flex-col min-w-0">
                    <span className="truncate text-neutral-900">{opt.label}</span>
                    {opt.helper && (
                      <span className="truncate text-caption text-neutral-500">{opt.helper}</span>
                    )}
                  </span>
                  {value === opt.value && (
                    <Check className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                  )}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverContent>
      </RPopover.Root>
    </Field>
  )
}
