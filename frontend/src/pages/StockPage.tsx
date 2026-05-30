// REV 2.11 StockPage - Stok Porsi saja (raw-materials subsystem dihapus).
// Akses semua role (per matrix REV 2.3: view + opname + mark-habis terbuka).
// Aksi: restock pagi (kelipatan 5), barang masuk darurat, opname batch, mark habis quick.

import PortionStockTab from '@/components/stock/PortionStockTab'

export default function StockPage() {
  return (
    <div className="h-full flex flex-col">
      <header className="bg-white border-b border-neutral-200 px-3 sm:px-4 py-2.5 flex items-center gap-3 flex-wrap pt-safe md:pt-2.5">
        <h1 className="text-title font-semibold text-neutral-900">Stok</h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <PortionStockTab />
      </div>
    </div>
  )
}
