// REV 2.11 StockPage - Stok Porsi saja (raw-materials subsystem dihapus).
// Akses semua role (per matrix REV 2.3: view + opname + mark-habis terbuka).
// Aksi: restock pagi (kelipatan 5), barang masuk darurat, opname batch, mark habis quick.

import { PageHeader } from '@/design-system/primitives'
import PortionStockTab from '@/components/stock/PortionStockTab'

export default function StockPage() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Stok" />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <PortionStockTab />
      </div>
    </div>
  )
}
