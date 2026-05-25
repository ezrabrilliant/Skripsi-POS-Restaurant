import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type IconButtonVariant = 'solid' | 'ghost' | 'outline' | 'danger'
export type IconButtonSize = 'sm' | 'md' | 'lg'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Wajib untuk a11y — disampaikan ke screen reader. */
  label: string
  icon: ReactNode
  variant?: IconButtonVariant
  size?: IconButtonSize
  loading?: boolean
  /** Tampilkan badge bulat kecil di pojok kanan-atas (mis. cart count). */
  badge?: ReactNode
}

const VARIANT: Record<IconButtonVariant, string> = {
  solid:   'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 disabled:bg-primary-300',
  ghost:   'bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 disabled:text-neutral-400',
  outline: 'border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 active:bg-neutral-100 disabled:bg-neutral-50 disabled:text-neutral-400',
  danger:  'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 disabled:bg-danger-300',
}

const SIZE: Record<IconButtonSize, string> = {
  sm: 'h-11 w-11 [&_svg]:h-4 [&_svg]:w-4',  // 44px min touch target
  md: 'h-12 w-12 [&_svg]:h-5 [&_svg]:w-5',
  lg: 'h-14 w-14 [&_svg]:h-6 [&_svg]:w-6',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    variant = 'ghost',
    size = 'md',
    loading = false,
    badge,
    disabled,
    className,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex items-center justify-center rounded-md transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed select-none',
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {badge !== undefined && badge !== null && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-danger-600 text-white text-[10px] font-semibold tabular-nums"
          aria-hidden
        >
          {badge}
        </span>
      )}
    </button>
  )
})
