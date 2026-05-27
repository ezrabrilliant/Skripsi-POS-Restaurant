// PaymentMethodFormModal - stub (Task 11.4 fills implementation).

import type { PaymentMethodView, BankView } from '@/types'
import { Dialog, Button } from '@/design-system/primitives'

interface Props {
  existing: PaymentMethodView | null
  allBanks: BankView[]
  onClose: () => void
  onSuccess: () => void
}

export function PaymentMethodFormModal({ existing, onClose }: Props) {
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? `Edit: ${existing.label}` : 'Tambah Metode Pembayaran'}
      size="md"
      footer={<Button variant="primary" size="md" fullWidth onClick={onClose}>Coming soon (Task 11.4)</Button>}
    >
      <div className="text-body-sm text-neutral-500">
        Form belum diimplementasi — selesai di Task 11.4.
      </div>
    </Dialog>
  )
}
