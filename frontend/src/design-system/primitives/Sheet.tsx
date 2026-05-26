/**
 * Sheet — drawer khusus mobile-friendly. Slide dari bottom (default)
 * atau right. Pakai Radix Dialog sebagai foundation untuk a11y +
 * focus trap, motion via framer-motion. Untuk full-page experience
 * di mobile (cart, filter, settlement steps).
 */

import { type ReactNode } from 'react'
import * as RDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fadeIn, transition } from '../motion'

type SheetSide = 'bottom' | 'right'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
  description?: ReactNode
  side?: SheetSide
  /** Tinggi sheet bottom: 'auto' (content-driven), '60vh', '85vh', '100vh' */
  height?: 'auto' | '60vh' | '85vh' | '100vh'
  /** Hide close button & header (raw mode) */
  hideHeader?: boolean
  footer?: ReactNode
  children: ReactNode
}

const HEIGHT_CLASS: Record<NonNullable<SheetProps['height']>, string> = {
  auto:   '',
  '60vh': 'h-[60dvh]',
  '85vh': 'h-[85dvh]',
  '100vh':'h-[100dvh]',
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  side = 'bottom',
  height = 'auto',
  hideHeader = false,
  footer,
  children,
}: SheetProps) {
  const isBottom = side === 'bottom'

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div
                style={{ zIndex: 30 }}
                className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm"
                variants={fadeIn}
                initial="initial"
                animate="animate"
                exit="exit"
              />
            </RDialog.Overlay>
            <RDialog.Content asChild forceMount>
              <motion.div
                style={{ zIndex: 30 }}
                className={cn(
                  'fixed bg-white shadow-lg flex flex-col overflow-hidden',
                  isBottom
                    ? cn(
                        'left-0 right-0 bottom-0 rounded-t-2xl max-h-[92dvh]',
                        HEIGHT_CLASS[height],
                        'pb-safe'
                      )
                    : 'top-0 bottom-0 right-0 w-full sm:max-w-md rounded-l-2xl'
                )}
                initial={isBottom ? { y: '100%' } : { x: '100%' }}
                animate={isBottom ? { y: 0 } : { x: 0 }}
                exit={isBottom ? { y: '100%' } : { x: '100%' }}
                transition={transition}
              >
                {isBottom && (
                  <div className="flex items-center justify-center pt-2.5 pb-1">
                    <div className="h-1 w-10 rounded-full bg-neutral-300" aria-hidden />
                  </div>
                )}

                {!hideHeader && (title || description) && (
                  <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-3 border-b border-neutral-200">
                    <div className="min-w-0 flex-1">
                      {title && (
                        <RDialog.Title className="text-title font-semibold text-neutral-900">
                          {title}
                        </RDialog.Title>
                      )}
                      {description && (
                        <RDialog.Description className="mt-0.5 text-body-sm text-neutral-600">
                          {description}
                        </RDialog.Description>
                      )}
                    </div>
                    <RDialog.Close asChild>
                      <button
                        type="button"
                        aria-label="Tutup"
                        className="h-9 w-9 inline-flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </RDialog.Close>
                  </div>
                )}
                {hideHeader && (
                  /* Provide invisible title for a11y */
                  <RDialog.Title className="sr-only">{title ?? 'Sheet'}</RDialog.Title>
                )}
                {/* Radix wajibkan Description ATAU aria-describedby={undefined}. Render
                   sr-only Description default kalau caller tidak passing description
                   prop, supaya screen reader punya konteks + console tidak warn. */}
                {!description && (
                  <RDialog.Description className="sr-only">
                    {typeof title === 'string' ? title : 'Panel'}
                  </RDialog.Description>
                )}

                <div className="flex-1 overflow-y-auto">{children}</div>

                {footer && (
                  <div className="px-5 pt-3 pb-4 border-t border-neutral-200 bg-neutral-50/50">
                    {footer}
                  </div>
                )}
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  )
}
