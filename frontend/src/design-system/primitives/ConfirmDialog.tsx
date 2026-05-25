/**
 * ConfirmDialog — confirmation modal yang dipakai oleh useConfirm hook.
 * Internal primitive — biasanya jangan dipanggil langsung, pakai
 * useConfirm() di-app supaya imperatif & a11y-clean.
 */

import type { ReactNode } from 'react'
import { Dialog } from './Dialog'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmText: string
  cancelText: string
  tone: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  tone,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="py-1" />
    </Dialog>
  )
}
