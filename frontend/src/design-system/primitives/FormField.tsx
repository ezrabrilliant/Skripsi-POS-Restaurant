/**
 * FormField — Generic wrapper untuk integrasi react-hook-form +
 * Input/Select/Textarea/etc primitives. Bypass repetition Controller +
 * field state propagation.
 *
 * Usage:
 *   <FormField name="email" control={control} label="Email" error={errors.email?.message}>
 *     {(field) => <Input {...field} type="email" />}
 *   </FormField>
 *
 * Atau langsung via register kalau field-nya native:
 *   <Input label="Nama" error={errors.name?.message} {...register('name')} />
 *
 * Karena Input/Select sudah forwardRef + accept label/error props,
 * pemakaian via register() lebih simple. FormField berguna untuk Controller
 * pattern (mis. custom Combobox, DatePicker future).
 */

import type { ReactNode } from 'react'
import { Controller, type Control, type FieldValues, type Path, type FieldError } from 'react-hook-form'

interface FormFieldProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  label?: string
  helper?: string
  /** Error message dari formState.errors[name]?.message */
  error?: string | FieldError
  /** Render-prop receive field state */
  children: (field: {
    name: string
    value: unknown
    onChange: (...args: unknown[]) => void
    onBlur: () => void
    ref: (instance: unknown) => void
  }) => ReactNode
}

export function FormField<T extends FieldValues>({
  name,
  control,
  label,
  helper,
  error,
  children,
}: FormFieldProps<T>) {
  const errorMessage = typeof error === 'string' ? error : error?.message
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          {label && (
            <label htmlFor={name} className="text-label text-neutral-700">
              {label}
            </label>
          )}
          {children(field as never)}
          {helper && !errorMessage && (
            <p className="text-caption text-neutral-500">{helper}</p>
          )}
          {errorMessage && (
            <p className="text-caption text-danger-700" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      )}
    />
  )
}
