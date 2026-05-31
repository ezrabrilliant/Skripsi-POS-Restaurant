// CostHistoryDrawer - drawer riwayat perubahan modal/COGS per menu (REV 2.11).
// Diekstrak supaya dipakai bareng MenuJualTab + VarianSkuTab (tab Katalog Menu).
// Memetakan MenuCostMovementView ke HistoryMovement (shape generic StockHistorySheet):
// costBefore→qtyBefore, costAfter→qtyAfter, delta = after − before, unit "Rp".

import { useQuery } from '@tanstack/react-query'
import { menuService } from '@/services/menuService'
import { COST_REASON_LABEL } from '@/types'
import { StockHistorySheet, type HistoryMovement } from '@/components/stock/StockHistorySheet'

export function CostHistoryDrawer({ menuId, onClose }: { menuId: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['menuCostHistory', menuId],
    queryFn: () => menuService.costHistory(menuId),
  })
  const movements: HistoryMovement[] = (data ?? []).map((m) => ({
    id: m.id,
    reasonLabel: COST_REASON_LABEL[m.reason],
    delta: (m.costAfter ?? 0) - (m.costBefore ?? 0),
    qtyBefore: m.costBefore,
    qtyAfter: m.costAfter,
    note: m.note,
    userName: m.userName,
    createdAt: m.createdAt,
    sourceLabel: null,
  }))
  return (
    <StockHistorySheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Riwayat Modal"
      isLoading={isLoading}
      movements={movements}
      unitSuffix="Rp"
    />
  )
}
