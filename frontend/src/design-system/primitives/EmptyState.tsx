import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  /** Compact variant untuk card / inline */
  compact?: boolean
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6 px-4' : 'py-12 px-6',
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500',
            compact ? 'h-10 w-10 [&_svg]:h-5 [&_svg]:w-5 mb-3' : 'h-14 w-14 [&_svg]:h-7 [&_svg]:w-7 mb-4'
          )}
          aria-hidden
        >
          {icon}
        </div>
      )}
      <h3 className={cn('font-semibold text-neutral-900', compact ? 'text-body' : 'text-title')}>{title}</h3>
      {description && (
        <p className={cn('mt-1 text-neutral-600 max-w-sm', compact ? 'text-body-sm' : 'text-body')}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
