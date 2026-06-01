import type { ReactNode } from 'react'
import { PageHeader } from './PageHeader'
import { PageContainer } from './PageContainer'
import type { TabItem } from './Tabs'

interface PageProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  tabs?: { items: TabItem[]; value: string; onValueChange: (value: string) => void }
  tabsScrollable?: boolean
  /** Bila true, children TIDAK dibungkus PageContainer - dipakai saat body adalah
   *  child tab-swapped yang sudah punya PageContainer sendiri (pola Menu/Stock/Setting). */
  bare?: boolean
  /** Override class kolom konten (diteruskan ke PageContainer; diabaikan bila bare). */
  containerClassName?: string
  children: ReactNode
}

/**
 * Shell halaman kanonik = `h-full flex flex-col` + PageHeader (bar putih pinned)
 * + area scroll (`flex-1 min-h-0 overflow-y-auto`) + PageContainer (kolom 6xl).
 *
 * Pakai untuk halaman yang body-nya inline (list/form). Untuk halaman dengan child
 * tab-swapped yang bungkus PageContainer sendiri, pakai prop `bare` (hindari double-wrap).
 */
export function Page({
  title,
  subtitle,
  actions,
  tabs,
  tabsScrollable,
  bare,
  containerClassName,
  children,
}: PageProps) {
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={actions}
        tabs={tabs}
        tabsScrollable={tabsScrollable}
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {bare ? children : <PageContainer className={containerClassName}>{children}</PageContainer>}
      </div>
    </div>
  )
}
