import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: ReactNode
  /** Escape hatch untuk override rhythm (mis. dashboard pakai space-y-4). */
  className?: string
}

/**
 * Kolom konten kanonik: SATU lebar + gutter + ritme vertikal untuk semua halaman.
 * Lebar `max-w-6xl` (≈1152px), centered, gutter `px-3 sm:px-4`, padding `py-4`.
 *
 * Aturan: pakai TEPAT SEKALI per area scroll — JANGAN di-nest (double mx-auto =
 * konten menyempit; double py = padding ganda). Halaman form yang butuh kolom
 * lebih ramping bungkus field-nya di div `max-w-3xl mx-auto` DI DALAM container ini.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-3', className)}>
      {children}
    </div>
  )
}
