import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  /** Shape: rounded-md default, full untuk avatar, none untuk text line */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full'
  circle?: boolean
}

const ROUNDED = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
} as const

export function Skeleton({ className, rounded = 'md', circle = false }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'animate-shimmer bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%]',
        circle ? 'rounded-full' : ROUNDED[rounded],
        className
      )}
    >
      <span className="sr-only">Memuat…</span>
    </div>
  )
}

/** Multi-line skeleton helper. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}
