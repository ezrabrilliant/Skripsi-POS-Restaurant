import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRupiah } from '@/lib/utils'

interface StatProps {
  label: string
  value: number | string
  /** Tipe format untuk angka. Kalau string, langsung pakai. */
  format?: 'rupiah' | 'number' | 'percent' | 'raw'
  delta?: {
    /** Numerik untuk percent change. Bisa positive/negative. */
    value: number
    /** Suffix opsional di sebelah angka delta (mis. "% vs kemarin") */
    suffix?: string
  }
  icon?: ReactNode
  /** Variant tampilan */
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Helper kecil di bawah value (mis. periode label) */
  hint?: ReactNode
}

const SIZE = {
  sm: { value: 'text-title font-semibold', card: 'p-3' },
  md: { value: 'text-headline font-semibold', card: 'p-4' },
  lg: { value: 'text-display', card: 'p-5' },
} as const

function formatValue(v: number | string, fmt: StatProps['format']): string {
  if (typeof v === 'string') return v
  if (fmt === 'rupiah') return formatRupiah(v)
  if (fmt === 'percent') return `${v.toFixed(1)}%`
  if (fmt === 'number') return new Intl.NumberFormat('id-ID').format(v)
  return String(v)
}

export function Stat({
  label,
  value,
  format = 'raw',
  delta,
  icon,
  size = 'md',
  className,
  hint,
}: StatProps) {
  const s = SIZE[size]
  const deltaPositive = delta && delta.value > 0
  const deltaNegative = delta && delta.value < 0
  return (
    <div
      className={cn(
        'rounded-xl bg-white border border-neutral-200 shadow-xs',
        s.card,
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-label text-neutral-600 truncate">{label}</div>
        {icon && <div className="text-neutral-400 shrink-0">{icon}</div>}
      </div>
      <div className={cn('mt-1 tabular-nums text-neutral-900', s.value)}>
        {formatValue(value, format)}
      </div>
      {delta && (
        <div
          className={cn(
            'mt-1.5 inline-flex items-center gap-1 text-body-sm font-medium',
            deltaPositive && 'text-success-700',
            deltaNegative && 'text-danger-700',
            !deltaPositive && !deltaNegative && 'text-neutral-500'
          )}
        >
          {deltaPositive && <ArrowUp className="h-3.5 w-3.5" />}
          {deltaNegative && <ArrowDown className="h-3.5 w-3.5" />}
          <span className="tabular-nums">
            {Math.abs(delta.value).toFixed(1)}
            {delta.suffix ?? '%'}
          </span>
        </div>
      )}
      {hint && <div className="mt-1.5 text-caption text-neutral-500">{hint}</div>}
    </div>
  )
}
