/**
 * useConfirm - imperative confirmation dialog menggunakan Radix Dialog.
 *
 * Pakai untuk replace window.confirm() (void transaction, delete user, dll)
 * dengan a11y-compliant + styled modal yang konsisten dgn design system.
 *
 * Usage:
 *   const confirm = useConfirm()
 *   const ok = await confirm({ title: 'Void?', description: '...', confirmText: 'Void', tone: 'danger' })
 *   if (!ok) return
 *
 * Provider <ConfirmProvider> wajib dipasang di root (App.tsx).
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../primitives/ConfirmDialog'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  tone?: 'default' | 'danger'
}

type Resolver = (value: boolean) => void

interface ConfirmContextValue {
  request: (opts: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<Resolver | null>(null)

  const request = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setOpts(options)
      setOpen(true)
    })
  }, [])

  const handle = useCallback((value: boolean) => {
    setOpen(false)
    const r = resolverRef.current
    resolverRef.current = null
    if (r) r(value)
  }, [])

  return (
    <ConfirmContext.Provider value={{ request }}>
      {children}
      {opts && (
        <ConfirmDialog
          open={open}
          onOpenChange={(v) => {
            if (!v) handle(false)
          }}
          title={opts.title}
          description={opts.description}
          confirmText={opts.confirmText ?? 'Ya, Lanjut'}
          cancelText={opts.cancelText ?? 'Batal'}
          tone={opts.tone ?? 'default'}
          onConfirm={() => handle(true)}
          onCancel={() => handle(false)}
        />
      )}
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within <ConfirmProvider>. Pasang di App.tsx root.')
  }
  return ctx.request
}
