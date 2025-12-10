// User types
export type UserRole = 'owner' | 'cashier'

export interface User {
  id: string
  name: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Menu types
export interface Menu {
  id: string
  name: string
  price: number
  category: string
  description: string | null
  defaultStock: number
  isActive: boolean
}

export interface MenuWithStock extends Menu {
  stockStart: number
  stockSold: number
  stockRemaining: number
}

// Transaction types
export type TransactionStatus = 'open' | 'paid' | 'void'
export type PaymentMethod = 'cash' | 'edc_bca' | 'edc_mandiri' | 'qris' | 'transfer'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Tunai' },
  { value: 'edc_bca', label: 'EDC BCA' },
  { value: 'edc_mandiri', label: 'EDC Mandiri' },
  { value: 'qris', label: 'QRIS' },
  { value: 'transfer', label: 'Transfer' },
]

export interface TransactionItem {
  id: string
  transactionId: string
  menuId: string
  menuName: string
  quantity: number
  priceAtTime: number
  subtotal: number
  notes: string | null
  isForceOrder: boolean
  createdAt: string
  menu?: { id: string; name: string; price: number }
}

export interface Transaction {
  id: string
  tableNumber: string
  status: TransactionStatus
  paymentMethod: PaymentMethod | null
  subtotal: number
  discountAmount: number
  totalAmount: number
  amountPaid: number
  changeAmount: number
  notes: string | null
  cashierId: string | null
  cashier?: { id: string; name: string }
  user?: { id: string; name: string }
  items: TransactionItem[]
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

// Cart types (local state)
export interface CartItem {
  id: string
  menuId: string
  menuName: string
  price: number
  quantity: number
  notes: string
  isForceOrder: boolean
  subtotal: number
}

// Table status
export interface TableStatus {
  tableNumber: string
  status: 'empty' | 'occupied'
  transactionId?: string
  totalAmount?: number
  itemCount?: number
  createdAt?: string
}

// Settlement types
export interface Settlement {
  id: string
  date: string
  cashierId: string
  cashier?: { id: string; name: string }
  systemCash: number
  systemEdc: number
  systemTransfer: number
  systemTotal: number
  actualCash: number
  actualEdc: number
  actualTransfer: number
  actualTotal: number
  variance: number
  varianceCash: number
  varianceEdc: number
  varianceTotal: number
  varianceReason: string | null
  status: 'pending' | 'submitted' | 'reviewed'
  notes: string | null
}

// API Response type
export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
  message?: string
}
