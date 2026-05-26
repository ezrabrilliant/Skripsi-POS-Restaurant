// REV 2.6 SubOptionsModal - buka saat customer pilih menu paket.
// Display:
//   - Description (kalau ada)
//   - Item Tetap (info-only list, mis. Nasi Putih, Sayur Asem)
//   - Slot Pilihan (button group per slot, customer pilih 1 per slot)
// Validasi semua slot terisi, lalu kirim selection {choice.key: option.label}
// ke onConfirm.

import { useState } from 'react'
import { Check } from 'lucide-react'
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
  // Initialize tiap choice slot dengan opsi pertama (default)
  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const choice of paket.choices) {
      const firstOpt = choice.options[0]
      if (firstOpt) initial[choice.key] = firstOpt.label
    }
    return initial
  })

  const handleSelect = (key: string, value: string) => {
    setSelection((prev) => ({ ...prev, [key]: value }))
  }

  const handleConfirm = () => {
    // Validate all choice slots have a selection
    for (const choice of paket.choices) {
      if (!selection[choice.key]) return
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
          {formatCurrency(menu.price)} · Paket
        </span>
      }
      size="md"
      footer={
        <Button variant="primary" size="md" fullWidth onClick={handleConfirm}>
          Tambah ke Pesanan
        </Button>
      }
    >
      <div className="space-y-4">
        {paket.description && (
          <p className="text-body-sm text-neutral-600 italic">{paket.description}</p>
        )}

        {/* Item Tetap (info-only) */}
        {paket.fixedItems.length > 0 && (
          <div>
            <p className="text-label text-neutral-700 mb-2">Item Termasuk</p>
            <ul className="flex flex-col gap-1">
              {paket.fixedItems.map((item, idx) => (
                <li
                  key={`${item}-${idx}`}
                  className="flex items-center gap-2 text-body-sm text-neutral-800"
                >
                  <Check className="h-4 w-4 text-success-600 shrink-0" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Slot Pilihan */}
        {paket.choices.map((choice) => (
          <div key={choice.key}>
            <p className="text-label text-neutral-700 mb-2">{choice.label}</p>
            <div className="flex flex-wrap gap-2">
              {choice.options.map((opt) => {
                const isActive = selection[choice.key] === opt.label
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => handleSelect(choice.key, opt.label)}
                    aria-pressed={isActive}
                    className={cn(
                      'min-h-[44px] px-4 py-2 rounded-lg border text-body-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                      isActive
                        ? 'bg-primary-50 border-primary-500 text-primary-800 ring-1 ring-primary-500/40'
                        : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100',
                    )}
                  >
                    {opt.label}
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
