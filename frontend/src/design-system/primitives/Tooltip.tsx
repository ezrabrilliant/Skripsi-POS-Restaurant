/**
 * Tooltip - hanya muncul di desktop (touch device tidak punya hover state
 * yang reliable). Mobile no-op (children dirender langsung tanpa wrap).
 */

import type { ReactNode } from 'react'
import * as RTooltip from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'
import { useIsDesktop } from '../hooks/useMediaQuery'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delayDuration?: number
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RTooltip.Provider delayDuration={150}>{children}</RTooltip.Provider>
}

export function Tooltip({ content, children, side = 'right', delayDuration }: TooltipProps) {
  const isDesktop = useIsDesktop()
  if (!isDesktop) return <>{children}</>

  return (
    <RTooltip.Root delayDuration={delayDuration}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className={cn(
            'rounded-md bg-neutral-900 text-white text-caption px-2 py-1.5 shadow-md max-w-xs',
            'animate-fade-in'
          )}
          style={{ zIndex: 60 }}
        >
          {content}
          <RTooltip.Arrow className="fill-neutral-900" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}
