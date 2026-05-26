// QuickAddBumbuDasar - REV 2.5 Task 16. Tombol yang spawn multiple preset rows
// dari raw_materials kategori `bumbuDasar` sekaligus di form purchase.
//
// Kasir tinggal isi qty + harga (exact) atau subtotal + note (scale_0_5).
// Bisa hapus row yang ngga jadi dibeli via tombol trash di tiap row form.
//
// Konvensi: pakai Button primitive 'outline' variant (sesuai RawMaterialsTab
// "Tambah Bahan" toolbar action) + leftIcon Sprout/Plus.

import { useQuery } from '@tanstack/react-query'
import { Sprout } from 'lucide-react'
import { rawMaterialsService } from '@/services/rawMaterialsService'
import { Button } from '@/design-system/primitives'
import type { RawMaterialView } from '@/types'

export interface QuickAddBumbuDasarProps {
  onAdd: (items: RawMaterialView[]) => void
  /** Skip raw materials yang sudah ada di form (avoid duplicate row). */
  excludeIds?: number[]
  size?: 'sm' | 'md' | 'lg'
}

export default function QuickAddBumbuDasar({
  onAdd,
  excludeIds = [],
  size = 'sm',
}: QuickAddBumbuDasarProps) {
  const { data: allRms = [], isLoading } = useQuery({
    queryKey: ['rawMaterials', { category: 'bumbuDasar' }],
    queryFn: () => rawMaterialsService.list({ category: 'bumbuDasar' }),
  })

  const excludeSet = new Set(excludeIds)
  const eligible = allRms.filter((rm) => !excludeSet.has(rm.id))

  const handleClick = () => {
    if (eligible.length === 0) return
    onAdd(eligible)
  }

  const disabled = isLoading || eligible.length === 0
  const title = isLoading
    ? 'Memuat bumbu dasar...'
    : allRms.length === 0
      ? 'Belum ada raw material kategori Bumbu Dasar'
      : eligible.length === 0
        ? 'Semua bumbu dasar sudah ditambahkan'
        : `Tambah ${eligible.length} baris preset bumbu dasar`

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      leftIcon={<Sprout className="w-4 h-4" />}
      onClick={handleClick}
      disabled={disabled}
      title={title}
    >
      Bumbu Dasar ({eligible.length})
    </Button>
  )
}
