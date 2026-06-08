import type { ReactNode } from 'react'
import * as RTabs from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export interface TabItem {
  value: string
  label: ReactNode
  icon?: ReactNode
  /** Optional badge count di kanan label. */
  badge?: ReactNode
  disabled?: boolean
}

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  items: TabItem[]
  /** 'segmented' (pill bg neutral, indicator solid) atau 'underline' (line bawah only). */
  variant?: 'segmented' | 'underline'
  /** Horizontal scroll snap (mis. category MenuGrid). */
  scrollable?: boolean
  className?: string
  /** Konten panel: tiap panel { value, children } */
  panels?: Array<{ value: string; children: ReactNode }>
}

export function Tabs({
  value,
  onValueChange,
  items,
  variant = 'segmented',
  scrollable = false,
  className,
  panels,
}: TabsProps) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RTabs.List
        className={cn(
          variant === 'segmented' &&
            'inline-flex p-1 rounded-lg bg-neutral-100 border border-neutral-200 gap-1',
          variant === 'underline' && 'flex border-b border-neutral-200 gap-1',
          scrollable && 'flex-nowrap overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-fade-right max-w-full'
        )}
      >
        {items.map((item) => (
          <RTabs.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              'inline-flex items-center gap-1.5 text-body-sm font-medium transition-colors whitespace-nowrap snap-start',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              variant === 'segmented' && [
                'h-9 px-3 rounded-md',
                'text-neutral-600 hover:text-neutral-900',
                'data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-xs',
              ],
              variant === 'underline' && [
                'h-10 px-3 -mb-px border-b-2 border-transparent',
                'text-neutral-600 hover:text-neutral-900',
                'data-[state=active]:border-primary-600 data-[state=active]:text-primary-700',
              ]
            )}
          >
            {item.icon && <span className="[&_svg]:h-4 [&_svg]:w-4">{item.icon}</span>}
            {item.label}
            {item.badge !== undefined && item.badge !== null && (
              <span className="ml-1 text-caption font-normal text-neutral-500">{item.badge}</span>
            )}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {panels?.map((panel) => (
        <RTabs.Content key={panel.value} value={panel.value} className="mt-3 focus-visible:outline-none">
          {panel.children}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  )
}
