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

/**
 * REV 2.6: paket subOptions = fixed items + choice slots (drop konsep matrix lama).
 *
 * - fixedItems: nama menu yang SELALU termasuk dalam paket.
 *   Portion/linked targets di-decrement otomatis; nonStock cuma jadi catatan.
 * - choices: slot pilihan customer (mis. "Pilih Ayam", "Pilih Minuman").
 *   Tiap opsi punya label (display) + stockTarget (menu yang di-decrement, null=info only).
 */
export type LinkedSubOptions = { stockTarget: string }

export type PaketChoiceOption = {
  label: string
  stockTarget: string | null
}

export type PaketChoice = {
  key: string
  label: string
  options: PaketChoiceOption[]
}

export type PaketSubOptions = {
  description?: string
  fixedItems: string[]
  choices: PaketChoice[]
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
  // Hanya ada saat list dipanggil dengan includePopularity=true (POS).
  salesCount?: number
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

/** REV 2.6: payment method code adalah string dinamis (snake_case lowercase) yang
 * sumbernya tabel `payment_methods` di backend. Tidak ada lagi enum hardcoded di FE.
 * Konsumer pakai `paymentMethodService.list()` untuk fetch master metode + label +
 * colorHex + iconName + bank assignment.
 *
 * Backwards compatibility: tipe alias `PaymentMethod = string` dipertahankan
 * sementara supaya import existing (di transactionService, PaymentModal, dll) tidak
 * pecah. Phase 11+ akan refactor konsumer untuk drop alias ini sepenuhnya. */
export type PaymentMethod = string

/** REV 2.5: payment slice per Transaction. Single tender = 1 record, split tender = N.
 * sum(payments.amount) === Transaction.total saat status=paid. */
export interface TransactionPayment {
  id: number
  method: PaymentMethod
  bank: string | null
  amount: number
  recordedAt: string
  recordedById: number
  recordedByName: string
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
  /** REV 2.4: catatan per item dari waiter/kasir saat input order - komunikasi
   * customer ke dapur (mis. "kurang manis", "pedas level 2", "Panas"/"Dingin"
   * untuk teh & jeruk yang ambigu suhu). */
  notes: string | null
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
  /** REV 2.1: self-reference untuk merge bill. */
  mergedIntoId: number | null
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  items: TransactionItem[]
  /** REV 2.5: payment slices (1 untuk single tender, N untuk split tender).
   * sum(payments.amount) === total saat status=paid. */
  payments: TransactionPayment[]
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
// Payment method + Bank master (REV 2.6)
// ============================================================

/** REV 2.6: ringkasan bank yang ter-assign ke 1 payment method.
 * `isActive=false` artinya bank itu soft-deleted di master — UI render dengan
 * style muted + tooltip "(nonaktif)". */
export interface BankSummary {
  id: number
  name: string
  isActive: boolean
}

/** REV 2.6: view payment method dari master `payment_methods` (owner-configurable).
 * - `code` immutable setelah create (foreign-key reference oleh
 *   `transaction_payments.method`, `settlement_method_counts.payment_method_code`).
 * - `requiresBank=true` artinya kasir wajib pilih bank saat record payment
 *   (mis. EDC, transfer).
 * - `iconName` salah satu lucide-react preset yang di-whitelist backend. */
export interface PaymentMethodView {
  id: number
  code: string
  label: string
  colorHex: string
  iconName: string
  requiresBank: boolean
  allowDineIn: boolean
  allowTakeaway: boolean
  isActive: boolean
  displayOrder: number
  banks: BankSummary[]
  createdAt: string
  updatedAt: string
}

/** REV 2.6: view bank dari master `banks`. `methodCount` = jumlah payment_method
 * yang link ke bank ini (untuk display di tab Banks). */
export interface BankView {
  id: number
  name: string
  isActive: boolean
  methodCount: number
  createdAt: string
}

/** REV 2.6: entry agregat per payment method untuk dashboard `byMethod`. Backend
 * kirim sorted descending by total. Method code mapping ke `label` + `colorHex`
 * dari master `payment_methods` (fallback `{label: code, colorHex: '#888888'}`
 * kalau method sudah deleted dari master). */
export interface MethodTotalEntry {
  paymentMethodCode: string
  methodLabel: string
  colorHex: string
  total: number
}

// ============================================================
// Settlement (REV 2.6 - dinamis per payment method code)
// ============================================================

/** REV 2.6: 1 row per payment_method_code untuk Settlement.
 * counted = jumlah fisik input kasir. system = jumlah aggregate dari
 * transaction_payments. variance = counted - system (computed runtime). */
export interface SettlementMethodCountView {
  paymentMethodCode: string
  methodLabel: string
  colorHex: string
  counted: number
  system: number
  variance: number
}

/** REV 2.6: entry untuk Settlement.preview.system — system totals dari
 * transactions per method code. */
export interface SettlementSystemEntry {
  paymentMethodCode: string
  methodLabel: string
  colorHex: string
  total: number
}

/** REV 2.6: bank breakdown method jadi generic string (drop union
 * 'edc' | 'transfer'). Backend kirim semua payment_method.code yang
 * `requiresBank=true` punya transaksi di periode. */
export interface BankBreakdownEntry {
  method: string
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
  /** REV 2.6: array dinamis per payment method code (drop 12 field hardcoded
   * `system*`/`actual*`/`variance*`). Totals computed runtime di view. */
  methodCounts: SettlementMethodCountView[]
  totalCounted: number
  totalSystem: number
  totalVariance: number
  /** Reserved untuk future migration; backend Phase 6 belum punya kolom note. */
  note: string | null
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
  /** REV 2.6: dinamis array per payment method code. */
  system: SettlementSystemEntry[]
  totalSystem: number
  /** Shift-redesign: total modal awal (float baseline) seluruh shift di tanggal bisnis ini. */
  openingCashTotal: number
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
  /** REV 2.8: timestamp aktivitas manual terbaru (restock/opname). null = belum pernah. */
  lastStockedAt: string | null
}

export type PortionMovementReason =
  | 'order'
  | 'restockMorning'
  | 'restockEmergency'
  | 'manualAdjust'
  | 'refundVoid'

export const PORTION_REASON_LABEL: Record<PortionMovementReason, string> = {
  order: 'Penjualan',
  restockMorning: 'Restock Pagi',
  restockEmergency: 'Barang Masuk',
  manualAdjust: 'Opname / Penyesuaian',
  refundVoid: 'Refund / Void',
}

export interface PortionMovementView {
  id: number
  delta: number
  reason: PortionMovementReason
  qtyBefore: number | null
  qtyAfter: number | null
  note: string | null
  userId: number
  userName: string
  /** REV 2.8: tautan FK ke dokumen sumber (null untuk movement non-transaksi). */
  transactionId: number | null
  transactionItemId: number | null
  createdAt: string
}

export interface PortionStockDetail extends PortionStockView {
  recentMovements: PortionMovementView[]
}

// ============================================================
// Unit master (REV 2.5)
// ============================================================

/** REV 2.5: opname mode menentukan cara hitung stok bahan baku.
 * - exact: numerik akurat (kg, liter, pcs, gram, dll)
 * - scale_0_5: skala subjektif 0..5 (sachet, sdt, "secukupnya", dll - tidak praktis ditimbang) */
export type OpnameMode = 'exact' | 'scale_0_5'

export interface Unit {
  id: number
  label: string
  opnameMode: OpnameMode
  createdAt: string
  updatedAt: string
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
  /** REV 2.5.2: soft-delete flag. False = nonaktif (history dipertahankan, item
   * tersembunyi dari list default kecuali toggle "Tampilkan nonaktif" aktif). */
  isActive: boolean
  /** REV 2.5: unitId FK + populated unit object (opnameMode determines opname UI). */
  unitId: number
  unit: {
    id: number
    label: string
    opnameMode: OpnameMode
  }
  category: RawMaterialCategory
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
  /** REV 2.8: timestamp movement terbaru. null = belum pernah. */
  lastStockedAt: string | null
}

export type RawMaterialMovementReason = 'purchase' | 'opname' | 'manualAdjust'

export const RAW_REASON_LABEL: Record<RawMaterialMovementReason, string> = {
  purchase: 'Pembelian',
  opname: 'Opname',
  manualAdjust: 'Penyesuaian',
}

export interface RawMaterialMovementView {
  id: number
  delta: number
  reason: RawMaterialMovementReason
  qtyBefore: number | null
  qtyAfter: number | null
  note: string | null
  userId: number
  userName: string
  /** REV 2.8: tautan FK ke pembelian sumber (null untuk opname/manualAdjust). */
  purchaseId: number | null
  purchaseItemId: number | null
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
  /** REV 2.5.1: nullable untuk free-form line item (label set, no master FK). */
  rawMaterialId: number | null
  rawMaterialName: string | null
  rawMaterialUnit: string | null
  /** REV 2.5: opname mode dari unit raw material — drive UI render (exact = qty+price,
   * scale_0_5 = subtotal saja + note). REV 2.5.1: null untuk free-form. */
  rawMaterialOpnameMode: OpnameMode | null
  /** REV 2.5.1: free-form line item label (mis. "Bumbu dasar pasar", "Ayam mentah").
   * Set kalau rawMaterialId null. Mutually exclusive dengan rawMaterialId. */
  label: string | null
  /** REV 2.5: nullable untuk scale_0_5 mode (kasir hanya catat subtotal + note). */
  qty: number | null
  unitPrice: number | null
  subtotal: number
  note: string | null
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
