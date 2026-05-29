// REV 2.3 StockPage - 2 tab: Stok Porsi + Raw Materials.
// Akses semua role (per matrix REV 2.3: view + opname + mark-habis terbuka).
// Aksi per tab: restock pagi (kelipatan 5), barang masuk darurat, opname batch,
// mark habis quick. CRUD raw material owner-only.
//
// REV 2.9: deep-link aware. `/stock?tab=raw&action=opname&focusMenuId=12&status=rendah&q=ayam`
// → buka tab yang dituju, seed filter, sorot baris, buka modal. Intent ditangkap
// sekali (useRef) lalu URL dibersihkan supaya tidak memicu ulang.

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Package, Sprout } from 'lucide-react'
import PortionStockTab from '@/components/stock/PortionStockTab'
import RawMaterialsTab from '@/components/stock/RawMaterialsTab'
import { Tabs } from '@/design-system/primitives'
import { parseStockDeepLink, type StockTabId, type StockTabHandoff } from '@/components/stock/stockDeepLink'

export default function StockPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Tangkap intent deep-link sekali saat mount. Param boleh berubah setelahnya
  // (kita bersihkan), jadi ref menjaga nilai awal tetap stabil.
  const intentRef = useRef(parseStockDeepLink(searchParams))
  const intent = intentRef.current

  const [tab, setTab] = useState<StockTabId>(intent?.tab ?? 'portion')

  // Handoff hanya diberikan ke tab yang dituju, dan hanya selama belum dikonsumsi.
  const [handoff, setHandoff] = useState<StockTabHandoff | null>(() => {
    if (!intent) return null
    const { action, focusId, status, query } = intent
    if (!action && !focusId && !status && !query) return null
    return { action, focusId, status, query }
  })

  // Bersihkan query dari URL setelah ditangkap (sekali). Tab sudah memegang
  // handoff via state, jadi membersihkan URL tidak menghilangkan intent.
  useEffect(() => {
    if (searchParams.toString()) setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConsumed = () => setHandoff(null)

  return (
    <div className="h-full flex flex-col">
      <header className="bg-white border-b border-neutral-200 px-3 sm:px-4 py-2.5 flex items-center gap-3 flex-wrap pt-safe md:pt-2.5">
        <h1 className="text-title font-semibold text-neutral-900">Stok</h1>
        <div className="ml-auto">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as StockTabId)}
            items={[
              { value: 'portion', label: 'Stok Porsi', icon: <Package className="w-4 h-4" /> },
              { value: 'raw', label: 'Raw Materials', icon: <Sprout className="w-4 h-4" /> },
            ]}
            variant="segmented"
          />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'portion' ? (
          <PortionStockTab
            handoff={intent?.tab === 'portion' ? handoff : null}
            onHandoffConsumed={handleConsumed}
          />
        ) : (
          <RawMaterialsTab
            handoff={intent?.tab === 'raw' ? handoff : null}
            onHandoffConsumed={handleConsumed}
          />
        )}
      </div>
    </div>
  )
}
