/**
 * DataTable - responsive list. Desktop tampilan <table> standard,
 * mobile auto-fallback ke card stack via mobileCard render-prop.
 *
 * Tidak include sorting/pagination/virtualization built-in supaya tetap
 * ringan. Untuk dataset besar bisa di-wrap dengan TanStack Table di
 * future kalau perlu.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '../hooks/useMediaQuery'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'

export interface DataTableColumn<T> {
  /** Unique key. Bisa string atau pakai dot path (mis. 'user.name'). */
  key: string
  /** Header label di desktop. */
  header: ReactNode
  /** Render cell. Default: ambil row[key] via key sederhana. */
  cell?: (row: T, index: number) => ReactNode
  /** Alignment desktop column. */
  align?: 'left' | 'center' | 'right'
  /** Hide kolom ini di mobile (kalau ada mobileCard, ini diabaikan). */
  hideMobile?: boolean
  /** Width hint untuk desktop (mis. 'w-32', 'min-w-40'). */
  className?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[] | undefined
  /** Untuk skeleton loading row count. */
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: ReactNode
  emptyAction?: ReactNode
  /** Render card untuk mobile (`<md`). Fallback ke table compact kalau tidak diisi. */
  mobileCard?: (row: T, index: number) => ReactNode
  /** Click handler row. */
  onRowClick?: (row: T) => void
  /** Key extractor unique per row. */
  rowKey: (row: T, index: number) => string | number
  className?: string
}

function getCell<T>(row: T, col: DataTableColumn<T>, index: number): ReactNode {
  if (col.cell) return col.cell(row, index)
  // Simple key access (no dot path support to keep it simple)
  const value = (row as Record<string, unknown>)[col.key]
  return value as ReactNode
}

const ALIGN: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
  left:   'text-left',
  center: 'text-center',
  right:  'text-right',
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyTitle = 'Belum ada data',
  emptyDescription,
  emptyAction,
  mobileCard,
  onRowClick,
  rowKey,
  className,
}: DataTableProps<T>) {
  const isMobile = useIsMobile()

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        compact
      />
    )
  }

  // Mobile card view
  if (isMobile && mobileCard) {
    return (
      <div className={cn('space-y-2', className)}>
        {data.map((row, idx) => {
          const key = rowKey(row, idx)
          if (onRowClick) {
            return (
              <button
                key={key}
                type="button"
                onClick={() => onRowClick(row)}
                className="w-full text-left rounded-lg bg-white border border-neutral-200 hover:border-neutral-300 active:bg-neutral-50 transition-colors p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
              >
                {mobileCard(row, idx)}
              </button>
            )
          }
          return (
            <div
              key={key}
              className="rounded-lg bg-white border border-neutral-200 p-3"
            >
              {mobileCard(row, idx)}
            </div>
          )
        })}
      </div>
    )
  }

  // Desktop table view
  const visibleCols = isMobile ? columns.filter((c) => !c.hideMobile) : columns

  return (
    <div className={cn('rounded-lg border border-neutral-200 bg-white overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-2.5 text-label font-semibold text-neutral-600',
                    ALIGN[col.align ?? 'left'],
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.map((row, idx) => (
              <tr
                key={rowKey(row, idx)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  onRowClick && 'cursor-pointer hover:bg-neutral-50 transition-colors'
                )}
              >
                {visibleCols.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-3 py-2.5 text-neutral-800',
                      ALIGN[col.align ?? 'left'],
                      col.className
                    )}
                  >
                    {getCell(row, col, idx)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
