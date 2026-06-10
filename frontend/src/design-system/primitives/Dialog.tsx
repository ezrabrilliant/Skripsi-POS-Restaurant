/**
 * Dialog - modal universal. Mobile (`<sm`) auto-slide-up dari bawah
 * (sheet style). Tablet+ centered scaleIn. Pakai Radix Dialog untuk
 * focus trap, ESC handling, scroll lock, a11y (aria-modal, role).
 *
 * IMPORTANT: positioning pakai flexbox di wrapper, motion.div HANYA
 * handle animation transform. Kalau pakai Tailwind `-translate-x-1/2`
 * di motion.div, framer-motion's inline transform akan override Tailwind
 * → dialog muncul off-center.
 */

import { type ReactNode } from 'react'
import * as RDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '../hooks/useMediaQuery'
import { slideUpFade, scaleIn, fadeIn } from '../motion'

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  size?: DialogSize
  /** Hide close button (kalau action wajib pilih) */
  hideClose?: boolean
  /** Footer slot - biasanya untuk action buttons */
  footer?: ReactNode
  children: ReactNode
  /** Disable click outside to close */
  preventOutsideClose?: boolean
}

const SIZE: Record<DialogSize, string> = {
  sm:   'sm:max-w-sm',
  md:   'sm:max-w-md',
  lg:   'sm:max-w-lg',
  xl:   'sm:max-w-2xl',
  full: 'sm:max-w-4xl',
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  hideClose = false,
  footer,
  children,
  preventOutsideClose = false,
}: DialogProps) {
  const isMobile = useIsMobile()
  const variants = isMobile ? slideUpFade : scaleIn

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm"
                style={{ zIndex: 40 }}
                variants={fadeIn}
                initial="initial"
                animate="animate"
                exit="exit"
              />
            </RDialog.Overlay>
            {/* Wrapper handles positioning via flexbox - no transforms here.
               Motion.div inside hanya animate (transform property bebas dipakai). */}
            <RDialog.Content
              asChild
              forceMount
              onPointerDownOutside={preventOutsideClose ? (e) => e.preventDefault() : undefined}
              onEscapeKeyDown={preventOutsideClose ? (e) => e.preventDefault() : undefined}
              // Radix a11y: kalau description tidak diset, pass aria-describedby={undefined}
              // EXPLICITLY supaya Radix tidak warn "Missing Description". Bila description
              // diset, RDialog.Description di body auto-wire aria-describedby ke Content.
              {...(!description && { 'aria-describedby': undefined })}
            >
              <div
                style={{ zIndex: 40 }}
                // Positioning wrapper. Mobile: pakai tinggi DYNAMIC viewport (100dvh)
                // + top-0 alih-alih `inset-0`. `inset-0` mengikat ke LARGE viewport
                // (lvh) yang bagian bawahnya berada DI BELAKANG chrome bawah browser
                // mobile (URL bar / gesture bar). Dengan `items-end`, footer (tombol
                // aksi) jadi terdorong ke zona tertutup itu → "dibawah banget, ga
                // muncul". 100dvh = viewport yang benar-benar terlihat → footer naik
                // di atas chrome. Desktop: dvh == vh, perilaku sama (sm:items-center).
                className="fixed inset-x-0 top-0 h-[100dvh] flex justify-center items-end sm:items-center pointer-events-none sm:p-4"
              >
                <motion.div
                  className={cn(
                    'pointer-events-auto bg-white shadow-lg flex flex-col overflow-hidden',
                    // Mobile: bottom sheet - full width, attached to bottom edge
                    'w-full max-h-[92dvh] rounded-t-2xl',
                    // Tablet+: max-width capped, rounded full + max height adjusted
                    'sm:rounded-2xl sm:max-h-[85dvh]',
                    SIZE[size],
                    'pb-safe'
                  )}
                  variants={variants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {/* Mobile drag handle */}
                  <div className="sm:hidden flex items-center justify-center pt-2.5 pb-1">
                    <div className="h-1 w-10 rounded-full bg-neutral-300" aria-hidden />
                  </div>

                  <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
                    <div className="min-w-0 flex-1">
                      <RDialog.Title className="text-title font-semibold text-neutral-900">
                        {title}
                      </RDialog.Title>
                      {description && (
                        <RDialog.Description className="mt-1 text-body-sm text-neutral-600">
                          {description}
                        </RDialog.Description>
                      )}
                    </div>
                    {!hideClose && (
                      <RDialog.Close asChild>
                        <button
                          type="button"
                          aria-label="Tutup"
                          className="h-9 w-9 inline-flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </RDialog.Close>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>

                  {footer && (
                    <div className="px-5 pt-3 pb-4 border-t border-neutral-200 bg-neutral-50/50 flex items-center justify-end gap-2">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  )
}
