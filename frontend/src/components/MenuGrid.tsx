// REV 2.3 MenuGrid - display menu cards grouped per category dengan filter pencarian.
// onClick delegate ke parent (POSPage): paket dgn subOptions → buka modal;
// menu biasa → langsung addItem.

import { useMemo, useState } from 'react'
import { Search, UtensilsCrossed } from 'lucide-react'
import type { Menu } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Input, EmptyState, Skeleton, Badge, Tabs } from '@/design-system/primitives'
import { useDebounce } from '@/design-system/hooks/useDebounce'

interface Props {
  menus: Menu[]
  onMenuClick: (menu: Menu) => void
  loading?: boolean
}

function stockBadge(menu: Menu): { text: string; tone: 'success' | 'warning' | 'danger' } | null {
  if (menu.stockType !== 'portion') return null
  const qty = menu.portionStock?.currentQty ?? 0
  const min = menu.portionStock?.minStock ?? 0
  if (qty <= 0) return { text: 'Habis', tone: 'danger' }
  if (qty <= min) return { text: `Sisa ${qty}`, tone: 'warning' }
  return { text: `${qty}`, tone: 'success' }
}

export default function MenuGrid({ menus, onMenuClick, loading }: Props) {
  const [searchRaw, setSearchRaw] = useState('')
  const search = useDebounce(searchRaw, 180)
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all')

  const categories = useMemo(() => {
    // Sort kategori by total salesCount per kategori (desc) supaya kategori
    // terlaris muncul kiri. Tiebreak alfabet. Kalau backend belum kirim
    // salesCount (mis. cache lama), fallback ke alfabet murni.
    const totals = new Map<string, number>()
    for (const m of menus) {
      totals.set(m.category, (totals.get(m.category) ?? 0) + (m.salesCount ?? 0))
    }
    return Array.from(totals.keys()).sort((a, b) => {
      const diff = (totals.get(b) ?? 0) - (totals.get(a) ?? 0)
      if (diff !== 0) return diff
      return a.localeCompare(b)
    })
  }, [menus])

  const filtered = useMemo(() => {
    let list = menus.filter((m) => m.isActive)
    if (activeCategory !== 'all') list = list.filter((m) => m.category === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((m) => m.name.toLowerCase().includes(q))
    }
    // Sort: menu habis (portion qty<=0) ke paling bawah, sisanya terlaris (salesCount)
    // di atas, alfabet sebagai tiebreaker. Backend kirim salesCount via includePopularity.
    return [...list].sort((a, b) => {
      const aHabis = a.stockType === 'portion' && (a.portionStock?.currentQty ?? 0) <= 0
      const bHabis = b.stockType === 'portion' && (b.portionStock?.currentQty ?? 0) <= 0
      if (aHabis !== bHabis) return aHabis ? 1 : -1
      const aSales = a.salesCount ?? 0
      const bSales = b.salesCount ?? 0
      if (aSales !== bSales) return bSales - aSales
      return a.name.localeCompare(b.name)
    })
  }, [menus, activeCategory, search])

  const categoryItems = useMemo(
    () => [
      { value: 'all', label: 'Semua' },
      ...categories.map((c) => ({ value: c, label: c })),
    ],
    [categories]
  )

  return (
    // REV 2.4 fix mobile cut-off: flex-1 + min-h-0 supaya MenuGrid TIDAK overflow
    // parent flex-col (h-full sebelumnya = 100% parent → overflow di-luar header
    // dan bottom nav). flex-1 = fill remaining space setelah sibling header.
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Sticky filter bar */}
      <div className="sticky top-0 bg-neutral-100/95 backdrop-blur z-sticky px-3 py-2.5 space-y-2 border-b border-neutral-200/60">
        <Input
          type="search"
          inputMode="search"
          value={searchRaw}
          onChange={(e) => setSearchRaw(e.target.value)}
          placeholder="Cari menu…"
          leftIcon={<Search />}
          aria-label="Cari menu"
        />
        <Tabs
          value={activeCategory}
          onValueChange={(v) => setActiveCategory(v as string)}
          items={categoryItems}
          variant="segmented"
          scrollable
        />
      </div>

      {/* Grid content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-44" rounded="lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed />}
            title={search ? 'Tidak ada menu cocok' : 'Belum ada menu di kategori ini'}
            description={search ? 'Coba kata kunci lain.' : 'Owner bisa tambah menu di halaman Menu.'}
          />
        ) : (
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((menu) => {
              const badge = stockBadge(menu)
              const isPaket = !!(menu.subOptions && 'choices' in menu.subOptions)
              const isOutOfStock = menu.stockType === 'portion' && (menu.portionStock?.currentQty ?? 0) <= 0
              return (
                <button
                  key={menu.id}
                  onClick={() => onMenuClick(menu)}
                  disabled={isOutOfStock}
                  className={cn(
                    'group bg-white rounded-xl p-3 text-left border border-neutral-200/60',
                    'transition-all duration-fast active:scale-[0.97]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1',
                    isOutOfStock
                      ? 'opacity-60 cursor-not-allowed'
                      : 'hover:border-primary-300 hover:shadow-sm'
                  )}
                >
                  <div className="aspect-square w-full mb-2 bg-neutral-100 rounded-lg overflow-hidden">
                    {menu.imageUrl ? (
                      <img
                        src={menu.imageUrl}
                        alt={menu.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-300">
                        <UtensilsCrossed className="w-7 h-7" />
                      </div>
                    )}
                  </div>
                  <p className="text-body-sm font-medium text-neutral-900 line-clamp-2 min-h-[2.5rem]">
                    {menu.name}
                  </p>
                  <p className="text-body font-semibold text-primary-700 mt-1 tabular-nums">
                    {formatCurrency(menu.price)}
                  </p>
                  {(isPaket || badge) && (
                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                      {isPaket && (
                        <Badge tone="primary" size="sm" variant="soft">
                          Paket
                        </Badge>
                      )}
                      {badge && (
                        <Badge tone={badge.tone} size="sm" variant="soft">
                          {badge.text}
                        </Badge>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
