import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
export type BadgeSize = 'sm' | 'md'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: BadgeSize
  /** Variant: 'soft' (default) bg pastel + text gelap, 'solid' bg pekat + text putih, 'outline' border only */
  variant?: 'soft' | 'solid' | 'outline'
  leftIcon?: ReactNode
  children: ReactNode
}

const TONE_SOFT: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-success-100 text-success-800',
  warning: 'bg-warning-100 text-warning-800',
  danger:  'bg-danger-100 text-danger-800',
  info:    'bg-info-100 text-info-800',
}

const TONE_SOLID: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-700 text-white',
  primary: 'bg-primary-600 text-white',
  success: 'bg-success-600 text-white',
  warning: 'bg-warning-600 text-white',
  danger:  'bg-danger-600 text-white',
  info:    'bg-info-600 text-white',
}

const TONE_OUTLINE: Record<BadgeTone, string> = {
  neutral: 'border border-neutral-300 text-neutral-700',
  primary: 'border border-primary-300 text-primary-700',
  success: 'border border-success-300 text-success-800',
  warning: 'border border-warning-300 text-warning-800',
  danger:  'border border-danger-300 text-danger-800',
  info:    'border border-info-300 text-info-800',
}

const SIZE: Record<BadgeSize, string> = {
  sm: 'h-5 px-1.5 text-caption',
  md: 'h-6 px-2 text-label',
}

export function Badge({
  tone = 'neutral',
  size = 'sm',
  variant = 'soft',
  leftIcon,
  className,
  children,
  ...rest
}: BadgeProps) {
  const toneClass =
    variant === 'solid' ? TONE_SOLID[tone] : variant === 'outline' ? TONE_OUTLINE[tone] : TONE_SOFT[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-medium whitespace-nowrap',
        toneClass,
        SIZE[size],
        className
      )}
      {...rest}
    >
      {leftIcon}
      {children}
    </span>
  )
}
