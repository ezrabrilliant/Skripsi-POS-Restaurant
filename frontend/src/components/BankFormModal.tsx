// BankFormModal - stub (Task 11.5 fills implementation).

import type { BankView } from '@/types'
import { Dialog, Button } from '@/design-system/primitives'

interface Props {
  existing: BankView | null
  onClose: () => void
  onSuccess: () => void
}

export function BankFormModal({ existing, onClose }: Props) {
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? `Edit: ${existing.name}` : 'Tambah Bank'}
      size="sm"
      footer={<Button variant="primary" size="md" fullWidth onClick={onClose}>Coming soon (Task 11.5)</Button>}
    >
      <div className="text-body-sm text-neutral-500">
        Form belum diimplementasi — selesai di Task 11.5.
      </div>
    </Dialog>
  )
}
