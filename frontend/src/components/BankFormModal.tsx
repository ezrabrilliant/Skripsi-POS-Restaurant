// BankFormModal - REV 2.6 create / edit bank master.
//
// Field:
//   - name      (text, required, trim non-empty)
//   - isActive  (toggle, edit only - soft delete via toggle ini)
//
// Info read-only saat edit: "Dipakai di N metode" (dari bank.methodCount).
// Konteks: kalau bank dipakai di method dan di-nonaktifkan, method yang
// requiresBank tidak bisa pakai bank ini lagi di transaksi baru (display
// di PaymentModal filter isActive).
//
// Submit via bankService.create / update.
// Permission: page sudah di-gate owner-only.

import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { bankService, type CreateBankInput, type UpdateBankInput } from '@/services/bankService'
import type { BankView } from '@/types'
import { Dialog, Button, Input, Checkbox } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

interface Props {
  existing: BankView | null
  onClose: () => void
  onSuccess: () => void
}

export function BankFormModal({ existing, onClose, onSuccess }: Props) {
  const toast = useToast()
  const [name, setName] = useState(existing?.name ?? '')
  const [isActive, setIsActive] = useState(existing?.isActive ?? true)

  const isEdit = !!existing
  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit && existing) {
        const patch: UpdateBankInput = { name: trimmed, isActive }
        return bankService.update(existing.id, patch)
      }
      const payload: CreateBankInput = { name: trimmed }
      return bankService.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Bank diperbarui' : 'Bank dibuat')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || mutation.isPending) return
    mutation.mutate()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !mutation.isPending && onClose()}
      title={isEdit ? `Edit: ${existing.name}` : 'Tambah Bank'}
      description={
        isEdit
          ? 'Ubah nama atau nonaktifkan bank. Bank yang sudah dipakai di transaksi tetap accessible untuk audit.'
          : 'Bank dipakai di metode pembayaran EDC / transfer untuk laporan per bank.'
      }
      size="sm"
      preventOutsideClose={mutation.isPending}
      footer={
        <Button
          type="submit"
          form="bank-form"
          variant="primary"
          size="md"
          fullWidth
          disabled={!canSubmit}
          loading={mutation.isPending}
        >
          {isEdit ? 'Simpan Perubahan' : 'Buat Bank'}
        </Button>
      }
    >
      <form id="bank-form" onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Nama bank"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="cth: BCA, Mandiri, BRI"
          autoFocus={!isEdit}
          required
        />

        {isEdit && existing && (
          <>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 flex items-start gap-2 text-body-sm">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-neutral-500" />
              <div className="text-neutral-700">
                Bank ini dipakai di{' '}
                <strong className="tabular-nums">{existing.methodCount}</strong>{' '}
                {existing.methodCount === 1 ? 'metode pembayaran' : 'metode pembayaran'}.
                {existing.methodCount > 0 && (
                  <span className="block text-caption text-neutral-500 mt-0.5">
                    Menonaktifkan bank akan menyembunyikannya dari picker bank di
                    PaymentModal, tapi transaksi historis tetap tercatat.
                  </span>
                )}
              </div>
            </div>

            <Checkbox
              label="Aktif (tampil di picker bank)"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </>
        )}
      </form>
    </Dialog>
  )
}
