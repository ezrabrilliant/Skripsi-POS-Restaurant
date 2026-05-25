import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:   'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 disabled:bg-primary-300',
  secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 disabled:bg-neutral-50 disabled:text-neutral-400',
  ghost:     'bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 disabled:text-neutral-400',
  danger:    'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 disabled:bg-danger-300',
  outline:   'border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 active:bg-neutral-100 disabled:bg-neutral-50 disabled:text-neutral-400',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-body-sm gap-1.5',
  md: 'h-10 px-4 text-body gap-2',
  lg: 'h-12 px-5 text-body gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed select-none',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  )
})
