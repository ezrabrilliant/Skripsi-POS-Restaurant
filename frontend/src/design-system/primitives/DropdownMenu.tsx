import type { ReactNode } from 'react'
import * as RDropdown from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

export interface DropdownItem {
  /** Label item. */
  label: string
  icon?: ReactNode
  onSelect?: () => void
  /** Tampilan danger (text merah). */
  danger?: boolean
  disabled?: boolean
  /** Render sebagai separator (label/onSelect diabaikan). */
  separator?: boolean
}

interface DropdownMenuProps {
  /** Element trigger (mis. IconButton). Wajib forwardRef-able. */
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'start' | 'center' | 'end'
  /** Side menu muncul. */
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

export function DropdownMenu({
  trigger,
  items,
  align = 'end',
  side = 'bottom',
  className,
}: DropdownMenuProps) {
  return (
    <RDropdown.Root>
      <RDropdown.Trigger asChild>{trigger}</RDropdown.Trigger>
      <RDropdown.Portal>
        <RDropdown.Content
          align={align}
          side={side}
          sideOffset={6}
          className={cn(
            'min-w-[180px] rounded-lg border border-neutral-200 bg-white shadow-md p-1',
            'animate-scale-in origin-top-right',
            className
          )}
          style={{ zIndex: 20 }}
        >
          {items.map((item, idx) => {
            if (item.separator) {
              return <RDropdown.Separator key={idx} className="h-px bg-neutral-200 my-1" />
            }
            return (
              <RDropdown.Item
                key={idx}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-body-sm rounded-md cursor-pointer outline-none select-none',
                  'data-[highlighted]:bg-neutral-100',
                  'data-[disabled]:text-neutral-400 data-[disabled]:cursor-not-allowed',
                  item.danger
                    ? 'text-danger-700 data-[highlighted]:bg-danger-50'
                    : 'text-neutral-800'
                )}
              >
                {item.icon && <span className="text-neutral-500 [&_svg]:h-4 [&_svg]:w-4">{item.icon}</span>}
                {item.label}
              </RDropdown.Item>
            )
          })}
        </RDropdown.Content>
      </RDropdown.Portal>
    </RDropdown.Root>
  )
}
