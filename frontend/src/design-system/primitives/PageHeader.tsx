import type { ReactNode } from 'react'
import { Tabs, type TabItem } from './Tabs'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  tabs?: { items: TabItem[]; value: string; onValueChange: (value: string) => void }
  /** Bila true, baris tab bisa di-scroll horizontal (cegah wrap saat tab banyak
   *  di layar sempit, mis. OwnerDashboard 4 tab / Setting 5 tab). */
  tabsScrollable?: boolean
}

export function PageHeader({ title, subtitle, actions, tabs, tabsScrollable }: PageHeaderProps) {
  return (
    <header className="bg-white border-b border-neutral-200 px-3 sm:px-4 py-2.5 flex items-center gap-3 flex-wrap pt-safe md:pt-2.5">
      <div className="min-w-0">
        <h1 className="text-title font-semibold text-neutral-900">{title}</h1>
        {subtitle != null && <p className="text-caption text-neutral-500">{subtitle}</p>}
      </div>
      {(tabs || actions) && (
        <div className="ml-auto flex items-center gap-2 flex-wrap min-w-0">
          {tabs && (
            <Tabs
              value={tabs.value}
              onValueChange={tabs.onValueChange}
              items={tabs.items}
              variant="segmented"
              scrollable={tabsScrollable}
            />
          )}
          {actions}
        </div>
      )}
    </header>
  )
}
