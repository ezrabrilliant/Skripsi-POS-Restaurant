// REV 2.15: tampilan struk di layar (fase sukses PaymentModal). Sumber data SAMA
// dengan PDF (buildReceiptRows) supaya layar ≡ PDF. Gaya "klasik rapi ramping":
// monospace, garis pemisah, header tengah, TOTAL & KEMBALIAN ditebalkan/dibesarkan.
import { buildReceiptRows, type ReceiptOptions } from '@/lib/receipt'
import type { Transaction } from '@/types'
import { cn } from '@/lib/utils'

const CHARS = 30 // selaras dengan receipt.ts (lebar baris pemisah)

export default function ReceiptPreview({
  tx,
  options,
  className,
}: {
  tx: Transaction
  options: ReceiptOptions
  className?: string
}) {
  const rows = buildReceiptRows(tx, options)
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[300px] rounded-lg border border-neutral-200 bg-white',
        'px-4 py-3 font-mono text-[12px] leading-[1.5] text-neutral-900 shadow-sm',
        className,
      )}
      role="document"
      aria-label={`Struk transaksi #${tx.id}`}
    >
      {rows.map((row, i) => {
        if (row.t === 'sep') {
          return (
            <div key={i} className="my-1 select-none text-neutral-400 overflow-hidden whitespace-nowrap">
              {row.c.repeat(CHARS)}
            </div>
          )
        }
        if (row.t === 'center') {
          return (
            <div
              key={i}
              className={cn('text-center', row.bold && 'font-bold text-[14px]')}
            >
              {row.s}
            </div>
          )
        }
        if (row.t === 'left') {
          return (
            <div key={i} className="whitespace-pre-wrap break-words">
              {row.s}
            </div>
          )
        }
        // row.t === 'lr'
        const emphasize = row.bold || row.l === 'TOTAL' || row.l === 'Kembali'
        return (
          <div
            key={i}
            className={cn(
              'flex items-baseline justify-between gap-3 tabular-nums',
              emphasize && 'font-bold',
              (row.l === 'TOTAL' || row.l === 'Kembali') && 'text-[14px]',
            )}
          >
            <span className="min-w-0 break-words">{row.l}</span>
            <span className="whitespace-nowrap">{row.r}</span>
          </div>
        )
      })}
    </div>
  )
}
