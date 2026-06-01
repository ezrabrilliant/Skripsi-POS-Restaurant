// REV 2.11 StockPage - Stok Porsi saja (raw-materials subsystem dihapus).
// Akses semua role (per matrix REV 2.3: view + opname + mark-habis terbuka).
// Aksi: restock pagi (kelipatan 5), barang masuk darurat, opname batch, mark habis quick.

import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/design-system/primitives'
import { portionService } from '@/services/portionService'
import PortionStockTab from '@/components/stock/PortionStockTab'

export default function StockPage() {
  // Subtitle insight: query SAMA-KEY dengan PortionStockTab (['portionStocks']) →
  // cache hit, tanpa fetch tambahan. Tab tetap pegang refetch-on-mount-nya sendiri.
  const { data: stocks } = useQuery({
    queryKey: ['portionStocks'],
    queryFn: () => portionService.list(),
  })
  const subtitle = stocks
    ? `${stocks.filter((s) => s.stockType === 'portion').length} stok porsi · ${stocks.filter((s) => s.isLow).length} rendah`
    : undefined

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Stok" subtitle={subtitle} />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <PortionStockTab />
      </div>
    </div>
  )
}
