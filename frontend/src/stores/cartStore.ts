import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, MenuWithStock } from '@/types'
import { generateId } from '@/lib/utils'

interface CartState {
  items: CartItem[]
  tableNumber: string
  transactionId: string | null
  notes: string
  discountAmount: number
  subtotal: number
  total: number
  
  // Actions
  setTableNumber: (tableNumber: string) => void
  setTransactionId: (id: string | null) => void
  setNotes: (notes: string) => void
  setDiscountAmount: (amount: number) => void
  
  // Cart operations
  addItem: (menu: MenuWithStock, forceOrder?: boolean) => void
  removeItem: (itemId: string) => void
  updateItemQuantity: (itemId: string, quantity: number) => void
  updateItemNotes: (itemId: string, notes: string) => void
  clearCart: () => void
  
  // Load existing transaction
  loadTransaction: (
    transactionId: string,
    tableNumber: string,
    items: CartItem[],
    notes: string,
    discountAmount: number
  ) => void
  
  // Check if needs force order
  needsForceOrder: (menu: MenuWithStock) => boolean
}

const calculateTotals = (items: CartItem[], discountAmount: number) => {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const total = Math.max(0, subtotal - discountAmount)
  return { subtotal, total }
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      tableNumber: '',
      transactionId: null,
      notes: '',
      discountAmount: 0,
      subtotal: 0,
      total: 0,
      
      setTableNumber: (tableNumber: string) => set({ tableNumber }),
      
      setTransactionId: (id: string | null) => set({ transactionId: id }),
      
      setNotes: (notes: string) => set({ notes }),
      
      setDiscountAmount: (amount: number) => {
        const { items } = get()
        const { subtotal, total } = calculateTotals(items, amount)
        set({ discountAmount: amount, subtotal, total })
      },
      
      needsForceOrder: (menu: MenuWithStock) => menu.stockRemaining <= 0,
      
      addItem: (menu: MenuWithStock, forceOrder: boolean = false) => {
        const { items, discountAmount } = get()
        
        const existingIndex = items.findIndex(
          (item) => item.menuId === menu.id && !item.notes
        )
        
        let newItems: CartItem[]
        
        if (existingIndex >= 0) {
          newItems = items.map((item, index) => {
            if (index === existingIndex) {
              const newQuantity = item.quantity + 1
              return {
                ...item,
                quantity: newQuantity,
                subtotal: item.price * newQuantity,
                isForceOrder: item.isForceOrder || forceOrder,
              }
            }
            return item
          })
        } else {
          const newItem: CartItem = {
            id: generateId(),
            menuId: menu.id,
            menuName: menu.name,
            price: menu.price,
            quantity: 1,
            notes: '',
            isForceOrder: forceOrder,
            subtotal: menu.price,
          }
          newItems = [...items, newItem]
        }
        
        const { subtotal, total } = calculateTotals(newItems, discountAmount)
        set({ items: newItems, subtotal, total })
      },
      
      removeItem: (itemId: string) => {
        const { items, discountAmount } = get()
        const newItems = items.filter((item) => item.id !== itemId)
        const { subtotal, total } = calculateTotals(newItems, discountAmount)
        set({ items: newItems, subtotal, total })
      },
      
      updateItemQuantity: (itemId: string, quantity: number) => {
        const { items, discountAmount } = get()
        
        if (quantity <= 0) {
          const newItems = items.filter((item) => item.id !== itemId)
          const { subtotal, total } = calculateTotals(newItems, discountAmount)
          set({ items: newItems, subtotal, total })
          return
        }
        
        const newItems = items.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              quantity,
              subtotal: item.price * quantity,
            }
          }
          return item
        })
        
        const { subtotal, total } = calculateTotals(newItems, discountAmount)
        set({ items: newItems, subtotal, total })
      },
      
      updateItemNotes: (itemId: string, notes: string) => {
        const { items } = get()
        const newItems = items.map((item) => {
          if (item.id === itemId) {
            return { ...item, notes }
          }
          return item
        })
        set({ items: newItems })
      },
      
      clearCart: () => {
        set({
          items: [],
          tableNumber: '',
          transactionId: null,
          notes: '',
          discountAmount: 0,
          subtotal: 0,
          total: 0,
        })
      },
      
      loadTransaction: (transactionId, tableNumber, items, notes, discountAmount) => {
        const { subtotal, total } = calculateTotals(items, discountAmount)
        set({
          transactionId,
          tableNumber,
          items,
          notes,
          discountAmount,
          subtotal,
          total,
        })
      },
    }),
    {
      name: 'pos-cart',
    }
  )
)
