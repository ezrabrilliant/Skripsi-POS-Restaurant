// REV 2.3 StockPage — 2 tab: Stok Porsi + Raw Materials.
// Akses semua role (per matrix REV 2.3: view + opname + mark-habis terbuka).
// Aksi per tab: restock pagi (kelipatan 5), barang masuk darurat, opname batch,
// mark habis quick. CRUD raw material owner-only.

import { useState } from 'react'
import { Package, Sprout } from 'lucide-react'
import PortionStockTab from '@/components/stock/PortionStockTab'
import RawMaterialsTab from '@/components/stock/RawMaterialsTab'
import { Tabs } from '@/design-system/primitives'

type StockTab = 'portion' | 'raw'

export default function StockPage() {
  const [tab, setTab] = useState<StockTab>('portion')

  return (
    <div className="h-full flex flex-col">
      <header className="bg-white border-b border-neutral-200 px-3 sm:px-4 py-2.5 flex items-center gap-3 flex-wrap pt-safe md:pt-2.5">
        <h1 className="text-title font-semibold text-neutral-900">Stok</h1>
        <div className="ml-auto">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as StockTab)}
            items={[
              { value: 'portion', label: 'Stok Porsi', icon: <Package className="w-4 h-4" /> },
              { value: 'raw', label: 'Raw Materials', icon: <Sprout className="w-4 h-4" /> },
            ]}
            variant="segmented"
          />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'portion' ? <PortionStockTab /> : <RawMaterialsTab />}
      </div>
    </div>
  )
}
