// REV 2.3 cart store. Drop: isForceOrder, transactionId (POSPage handles per-session),
// loadTransaction (per-session, tidak persist). Tambah: subOptionsSelected per CartItem,
// orderType, tableNumber jadi nullable (null kalau takeaway).
//
// CATATAN HYDRATION: Zustand persist hydrate state lama dari localStorage via
// Object.assign - kalau key di store baru bentrok dengan persisted value lama
// (mis. fungsi vs number), value lama akan override. Untuk hindari ini:
//   1. Computed helpers (subtotal, itemCount) DIEKSPOR sebagai standalone util,
//      bukan property di state. Komponen pakai `cartSubtotal(useCartStore())`.
//   2. Store name di-bump ke `pos-cart-v2` supaya cache REV 2 (yang punya field
//      subtotal/total/transactionId) tidak di-hydrate ke shape baru.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, OrderType } from '@/types'
import { generateId } from '@/lib/utils'

interface CartState {
  items: CartItem[]
  orderType: OrderType
  tableNumber: number | null

  // Add
  addItem: (input: {
    menuId: number
    menuName: string
    price: number
    qty?: number
    notes?: string
    subOptionsSelected?: Record<string, string> | null
  }) => void

  // Mutations per item id
  updateQty: (id: string, qty: number) => void
  updateNotes: (id: string, notes: string) => void
  removeItem: (id: string) => void

  // Order metadata
  setOrderType: (type: OrderType) => void
  setTableNumber: (n: number | null) => void

  // Reset
  clearCart: () => void
  /// REV 2.4: hanya kosongkan items, tableNumber + orderType dipertahankan.
  /// Dipakai POSPage saat user pindah meja - clear residue input tanpa reset
  /// pilihan meja yang baru saja di-set user.
  clearItems: () => void
}

function makeCartItem(input: {
  menuId: number
  menuName: string
  price: number
  qty?: number
  notes?: string
  subOptionsSelected?: Record<string, string> | null
}): CartItem {
  const qty = input.qty ?? 1
  return {
    id: generateId(),
    menuId: input.menuId,
    menuName: input.menuName,
    price: input.price,
    qty,
    notes: input.notes ?? '',
    subOptionsSelected: input.subOptionsSelected ?? null,
    subtotal: input.price * qty,
  }
}

function recomputeSubtotal(item: CartItem, qty: number): CartItem {
  return { ...item, qty, subtotal: item.price * qty }
}

/// 2 item dianggap "sama" kalau: sama menuId + sama subOptionsSelected JSON +
/// notes kosong di keduanya. Notes berbeda = entry terpisah supaya jelas di struk.
function isSameAggregable(a: CartItem, b: { menuId: number; subOptionsSelected: Record<string, string> | null; notes: string }): boolean {
  if (a.menuId !== b.menuId) return false
  if ((a.notes ?? '') !== '' || (b.notes ?? '') !== '') return false
  return JSON.stringify(a.subOptionsSelected ?? null) === JSON.stringify(b.subOptionsSelected ?? null)
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      orderType: 'dineIn',
      tableNumber: null,

      addItem: (input) => {
        const items = get().items
        const idx = items.findIndex((it) =>
          isSameAggregable(it, {
            menuId: input.menuId,
            subOptionsSelected: input.subOptionsSelected ?? null,
            notes: input.notes ?? '',
          }),
        )
        if (idx >= 0) {
          const existing = items[idx]!
          const updated = recomputeSubtotal(existing, existing.qty + (input.qty ?? 1))
          set({ items: items.map((it, i) => (i === idx ? updated : it)) })
        } else {
          set({ items: [...items, makeCartItem(input)] })
        }
      },

      updateQty: (id, qty) => {
        if (qty <= 0) {
          set({ items: get().items.filter((it) => it.id !== id) })
          return
        }
        set({
          items: get().items.map((it) => (it.id === id ? recomputeSubtotal(it, qty) : it)),
        })
      },

      updateNotes: (id, notes) => {
        set({
          items: get().items.map((it) => (it.id === id ? { ...it, notes } : it)),
        })
      },

      removeItem: (id) => {
        set({ items: get().items.filter((it) => it.id !== id) })
      },

      setOrderType: (type) => {
        set({ orderType: type, tableNumber: type === 'takeaway' ? null : get().tableNumber })
      },

      setTableNumber: (n) => set({ tableNumber: n }),

      clearCart: () => set({ items: [], orderType: 'dineIn', tableNumber: null }),

      clearItems: () => set({ items: [] }),
    }),
    {
      name: 'pos-cart-v2',
      partialize: (state) => ({
        items: state.items,
        orderType: state.orderType,
        tableNumber: state.tableNumber,
      }),
    },
  ),
)

// ============================================================
// Computed selectors (extracted as standalone util - TIDAK di state karena
// hydration persist bisa override function dengan value lama)
// ============================================================

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((s, it) => s + it.subtotal, 0)
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((s, it) => s + it.qty, 0)
}
