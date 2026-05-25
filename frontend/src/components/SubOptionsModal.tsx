// REV 2.3 SubOptionsModal — buka saat customer pilih menu paket dengan dynamic
// options. Display button group per group sub-option, validasi semua group
// terisi, lalu kirim selection {key: value} ke onConfirm. Parent (POSPage)
// yang push ke cart.

import { useState } from 'react'
import type { Menu, PaketSubOptions } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Dialog, Button } from '@/design-system/primitives'

interface Props {
  menu: Menu
  paket: PaketSubOptions
  onConfirm: (selection: Record<string, string>) => void
  onClose: () => void
}

export default function SubOptionsModal({ menu, paket, onConfirm, onClose }: Props) {
  // Initialize each group dgn opsi pertama (default)
  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const group of paket.options) {
      initial[group.key] = group.options[0]!
    }
    return initial
  })

  const handleSelect = (key: string, value: string) => {
    setSelection((prev) => ({ ...prev, [key]: value }))
  }

  const handleConfirm = () => {
    for (const group of paket.options) {
      if (!selection[group.key]) return
    }
    onConfirm(selection)
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={menu.name}
      description={
        <span className="tabular-nums">
          {formatCurrency(menu.price)} · Paket dengan pilihan
        </span>
      }
      size="md"
      footer={
        <Button variant="primary" size="md" fullWidth onClick={handleConfirm}>
          Tambah ke Keranjang
        </Button>
      }
    >
      <div className="space-y-4">
        {paket.description && (
          <p className="text-body-sm text-neutral-600 italic">{paket.description}</p>
        )}
        {paket.options.map((group) => (
          <div key={group.key}>
            <p className="text-label text-neutral-700 mb-2">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((opt) => {
                const isActive = selection[group.key] === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelect(group.key, opt)}
                    aria-pressed={isActive}
                    className={cn(
                      'min-h-[44px] px-4 py-2 rounded-lg border text-body-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                      isActive
                        ? 'bg-primary-50 border-primary-500 text-primary-800 ring-1 ring-primary-500/40'
                        : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100'
                    )}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  )
}
