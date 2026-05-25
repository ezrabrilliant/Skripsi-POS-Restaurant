// Tipe data frontend - REV 2.3 aligned dengan backend Express + Prisma.
// Backend mengirim camelCase + id integer + Decimal sebagai number (di-convert
// di service mapper). Tipe di sini reflect response shape Phase 1-9 backend.

// ============================================================
// User
// ============================================================

export type UserRole = 'owner' | 'cashier' | 'waiter'

export interface User {
  id: number
  name: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Pemilik',
  cashier: 'Kasir',
  waiter: 'Pelayan',
}

// ============================================================
// Menu
// ============================================================

export type StockType = 'portion' | 'linked' | 'nonStock'

/** REV 2.2 paket subOptions: 2 varian shape. */
export type LinkedSubOptions = { stockTarget: string }
export type PaketSubOptionGroup = {
  key: string
  label: string
  options: string[]
}
export type PaketSubOptions = {
  description?: string
  options: PaketSubOptionGroup[]
  stockMap: Record<string, string>
}
export type SubOptions = LinkedSubOptions | PaketSubOptions | null

export interface MenuPortionStockView {
  currentQty: number
  minStock: number
  openingQtyToday: number
  openingQtyDate: string
  updatedAt: string
}

export interface Menu {
  id: number
  name: string
  category: string
  price: number
  stockType: StockType
  minStock: number | null
  imageUrl: string | null
  subOptions: SubOptions
  isActive: boolean
  createdAt: string
  updatedAt: string
  portionStock: MenuPortionStockView | null
}

// ============================================================
// Order / Transaction
// ============================================================

export type OrderType = 'dineIn' | 'takeaway'

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  dineIn: 'Dine-in',
  takeaway: 'Takeaway',
}

export type TransactionStatus = 'open' | 'paid' | 'void'

/** REV 2.2: 6 metode. edc gabung debit+kredit. gojek/grab untuk merchant app settlement. */
export type PaymentMethod = 'cash' | 'edc' | 'qris' | 'gojek' | 'grab' | 'transfer'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; needsBank: boolean }[] = [
  { value: 'cash', label: 'Tunai', needsBank: false },
  { value: 'edc', label: 'EDC', needsBank: true },
  { value: 'qris', label: 'QRIS', needsBank: false },
  { value: 'gojek', label: 'GoFood', needsBank: false },
  { value: 'grab', label: 'GrabFood', needsBank: false },
  { value: 'transfer', label: 'Transfer Bank', needsBank: true },
]

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  edc: 'EDC',
  qris: 'QRIS',
  gojek: 'GoFood',
  grab: 'GrabFood',
  transfer: 'Transfer',
}

export interface TransactionItem {
  id: number
  menuId: number
  menuName: string
  qty: number
  unitPrice: number
  subtotal: number
  /** REV 2.2: hasil pilihan SubOptionsModal untuk paket. */
  subOptionsSelected: Record<string, string> | null
  /** REV 2.2: untuk split bill — item dengan partyId sama = 1 struk terpisah. Null = tidak split. */
  partyId: number | null
  createdAt: string
}

export interface Transaction {
  id: number
  shiftId: number
  orderType: OrderType
  /** Wajib int 1-9 kalau dineIn, null kalau takeaway. */
  tableNumber: number | null
  /** REV 2.3 shift-decoupling: user yang submit order (kasir/owner/waiter). */
  createdById: number
  createdByName: string
  /** REV 2.3 shift-decoupling: denormalize dari shift.cashier.name untuk display
   * "oleh {createdByName} · shift {shiftCashierName}". Sama dengan createdByName
   * kalau kasir input transaksi-nya sendiri. */
  shiftCashierName: string
  status: TransactionStatus
  paymentMethod: PaymentMethod | null
  /** REV 2.1: terisi hanya kalau paymentMethod=edc atau transfer. */
  paymentBank: string | null
  /** REV 2.1: self-reference untuk merge bill. */
  mergedIntoId: number | null
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  items: TransactionItem[]
  createdAt: string
  paidAt: string | null
  voidedAt: string | null
}

// ============================================================
// Cart (state lokal di cartStore)
// ============================================================

export interface CartItem {
  /** Unique id lokal supaya 2 entry menu yang sama dengan subOptions berbeda
   * tetap bisa dibedakan di cart. */
  id: string
  menuId: number
  menuName: string
  price: number
  qty: number
  notes: string
  subOptionsSelected: Record<string, string> | null
  subtotal: number
}

// ============================================================
// Meja
// ============================================================

export interface TableStatus {
  tableNumber: number
  status: 'empty' | 'occupied'
  transactionId?: number
  totalAmount?: number
  itemCount?: number
  createdAt?: string
}

// ============================================================
// Shift
// ============================================================

export type ShiftType = 'pagi' | 'malam'

export interface Shift {
  id: number
  date: string
  type?: ShiftType
  cashierId: number
  cashierName?: string
  openingCash: number
  closedAt: string | null
  createdAt: string
}

// ============================================================
// Settlement (REV 2.2 — 6 buckets)
// ============================================================

export interface MethodTotals {
  cash: number
  edc: number
  qris: number
  gojek: number
  grab: number
  transfer: number
}

export interface BankBreakdownEntry {
  method: 'edc' | 'transfer'
  bank: string
  total: number
}

export type SettlementStatus = 'submitted' | 'reviewed'

export interface Settlement {
  id: number
  shiftId: number
  date: string
  cashierId: number
  cashierName: string
  reviewerId: number | null
  reviewerName: string | null
  system: MethodTotals
  actual: MethodTotals
  variance: MethodTotals
  totalSystem: number
  totalActual: number
  totalVariance: number
  status: SettlementStatus
  submittedAt: string
  reviewedAt: string | null
  bankBreakdown: BankBreakdownEntry[]
}

export interface SettlementPreview {
  shiftId: number
  shiftType: ShiftType
  date: string
  cashierId: number
  cashierName: string
  closedAt: string | null
  system: MethodTotals
  totalSystem: number
  bankBreakdown: BankBreakdownEntry[]
  existingSettlementId: number | null
}

// ============================================================
// Stok porsi (REV 2.2)
// ============================================================

export interface PortionStockView {
  menuId: number
  menuName: string
  category: string
  currentQty: number
  minStock: number
  openingQtyToday: number
  openingQtyDate: string
  suggestedRestockMorning: number
  isLow: boolean
  updatedAt: string
}

export type PortionMovementReason =
  | 'order'
  | 'restockMorning'
  | 'restockEmergency'
  | 'manualAdjust'
  | 'refundVoid'

export interface PortionMovementView {
  id: number
  delta: number
  reason: PortionMovementReason
  note: string | null
  userId: number
  createdAt: string
}

export interface PortionStockDetail extends PortionStockView {
  recentMovements: PortionMovementView[]
}

// ============================================================
// Raw materials (REV 2.2)
// ============================================================

export type RawMaterialCategory =
  | 'bumbuDasar'
  | 'bahanSegar'
  | 'bahanPokok'
  | 'bahanKering'
  | 'lainnya'

export const RAW_MATERIAL_CATEGORY_LABEL: Record<RawMaterialCategory, string> = {
  bumbuDasar: 'Bumbu Dasar',
  bahanSegar: 'Bahan Segar',
  bahanPokok: 'Bahan Pokok',
  bahanKering: 'Bahan Kering',
  lainnya: 'Lainnya',
}

export interface RawMaterialView {
  id: number
  name: string
  unit: string
  category: RawMaterialCategory
  isTracked: boolean
  stockQty: number
  minStock: number | null
  unitPrice: number | null
  freshnessDays: number | null
  lastBuyDate: string | null
  isLowStock: boolean
  isNearExpiry: boolean
  daysUntilExpiry: number | null
  suggestedAction: string | null
  createdAt: string
  updatedAt: string
}

export type RawMaterialMovementReason = 'purchase' | 'opname' | 'manualAdjust'

export interface RawMaterialMovementView {
  id: number
  delta: number
  reason: RawMaterialMovementReason
  note: string | null
  userId: number
  createdAt: string
}

export interface RawMaterialDetail extends RawMaterialView {
  recentMovements: RawMaterialMovementView[]
}

// ============================================================
// Vendor
// ============================================================

export interface Vendor {
  id: number
  name: string
  type: string
  phone: string | null
  note: string | null
  purchaseCount: number
  createdAt: string
  updatedAt: string
}

// ============================================================
// Purchase (REV 2.1 normalized)
// ============================================================

export interface PurchaseItemView {
  id: number
  rawMaterialId: number
  rawMaterialName: string
  rawMaterialUnit: string
  isTracked: boolean
  qty: number
  unitPrice: number
  subtotal: number
  expiredDate: string | null
  createdAt: string
}

export interface Purchase {
  id: number
  date: string
  userId: number
  userName: string
  vendorId: number | null
  vendorName: string | null
  totalAmount: number
  note: string | null
  items: PurchaseItemView[]
  createdAt: string
}

// ============================================================
// Bill (owner-only)
// ============================================================

export type BillCategory = 'kebersihan' | 'listrik' | 'air' | 'parkir' | 'sewa'

export const BILL_CATEGORY_LABEL: Record<BillCategory, string> = {
  kebersihan: 'Iuran Kebersihan',
  listrik: 'Listrik',
  air: 'Air',
  parkir: 'Iuran Parkir',
  sewa: 'Sewa Tempat',
}

export interface Bill {
  id: number
  month: string
  category: BillCategory
  amount: number
  note: string | null
  userId: number
  userName: string
  createdAt: string
}

// ============================================================
// Common API response
// ============================================================

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}
