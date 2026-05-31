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

// ============================================================
// REV 2.10 - Menu Variants + Option Groups + Paket Components
// ============================================================
// Data-driven catalog layer yang menggantikan SubOptions JSON. Mirror dari
// backend menus.service.ts (MenuOptionGroupDetail / MenuVariantDetail /
// PaketComponentDetail) + menus.schema.ts (menuUpsertSchema) EXACT (field
// names + number vs string + nullability). Legacy SubOptions di atas
// dipertahankan untuk MenuPage/HistoryPage yang belum di-refactor.

/** REV 2.10: jenis menu - simple (1 harga, tanpa varian), variant (banyak
 * MenuVariant per kombinasi opsi), atau paket (kombinasi komponen tetap +
 * slot pilihan). Mirror dari Prisma enum MenuKind. */
export type MenuKind = 'simple' | 'variant' | 'paket'

/** REV 2.10: 1 opsi di dalam OptionGroup (mis. "Paha", "Dada" untuk grup
 * "Bagian Ayam"). Mirror MenuOptionDetail. */
export interface Option {
  id: number
  label: string
  displayOrder: number
}

/** REV 2.10: grup opsi pada menu. affectsVariant=true → opsi grup ini
 * membentuk MenuVariant (axis varian + harga eksak). affectsVariant=false →
 * free-preference (mis. Suhu dingin/panas) yang tidak pengaruh stok/harga.
 * Mirror MenuOptionGroupDetail. */
export interface OptionGroup {
  id: number
  name: string
  affectsVariant: boolean
  displayOrder: number
  options: Option[]
}

/** REV 2.10: varian sellable dari menu kind=variant - harga eksak per
 * kombinasi opsi. stockTargetMenuId = menu (biasanya SKU stok tersembunyi)
 * yang di-decrement saat varian terjual; null = tidak track stok.
 * optionIds = id MenuOption penyusun (dari grup affectsVariant=true).
 * Mirror MenuVariantDetail. */
export interface MenuVariant {
  id: number
  label: string
  price: number
  stockTargetMenuId: number | null
  /** REV 2.11: menu (SKU tersembunyi) sumber modal/COGS untuk varian nonStock
   * (stockTargetMenuId === null). Bila null, backend fallback ke stockTargetMenuId. */
  costSourceMenuId: number | null
  isActive: boolean
  displayOrder: number
  optionIds: number[]
}

/** REV 2.10: 1 opsi pilihan pada slot paket kind=choice. upcharge = tambahan
 * harga kalau opsi ini dipilih. Mirror PaketChoiceOptionDetail. Nama pakai
 * suffix Detail untuk hindari collision dengan legacy PaketChoiceOption
 * (SubOptions JSON-based) yang masih dipakai PaketBuilder. */
export interface PaketChoiceOptionDetail {
  id: number
  label: string
  targetMenuId: number | null
  targetVariantId: number | null
  upcharge: number
}

/** REV 2.10: komponen paket - 'fixed' (item tetap, selalu termasuk) atau
 * 'choice' (slot pilihan customer dengan choiceOptions). target* = menu/varian
 * yang di-decrement (untuk fixed). Mirror PaketComponentDetail. */
export interface PaketComponent {
  id: number
  kind: 'fixed' | 'choice'
  label: string
  qty: number
  displayOrder: number
  targetMenuId: number | null
  targetVariantId: number | null
  choiceOptions: PaketChoiceOptionDetail[]
}

/** REV 2.10: baris selection yang dipersist per TransactionItem - slot paket
 * (isPreference=false) + free-preference (isPreference=true, mis. Suhu).
 * Mirror TransactionItemSelection view (ResolvedItem.selections di backend). */
export interface TransactionItemSelection {
  groupOrSlotLabel: string
  chosenLabel: string
  targetMenuId: number | null
  targetVariantId: number | null
  isPreference: boolean
}

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
  /** REV 2.10: jenis menu (simple/variant/paket). */
  kind: MenuKind
  /** REV 2.10: tampil di grid POS? SKU stok granular (mis. "Paha Ayam Bakar")
   * di-set false supaya tersembunyi dari grid kasir tapi tetap jadi stock target. */
  posVisible: boolean
  minStock: number | null
  imageUrl: string | null
  subOptions: SubOptions
  isActive: boolean
  createdAt: string
  updatedAt: string
  portionStock: MenuPortionStockView | null
  // Hanya ada saat list dipanggil dengan includePopularity=true (POS).
  salesCount?: number
  /** REV 2.10: catalog layer - selalu ada di list (backend pakai menuDetailInclude)
   * + detail. Empty array kalau menu simple tanpa option/variant/paket. */
  optionGroups?: OptionGroup[]
  variants?: MenuVariant[]
  paketComponents?: PaketComponent[]
  /** REV 2.11: harga modal / COGS per porsi (leaf/simple). Hanya dikirim untuk
   * request owner-authenticated (soft-auth); POS/public TIDAK menerima field ini.
   * null pada parent variant/paket (modal hidup di leaf). */
  cost?: number | null
}

// ============================================================
// REV 2.10 - Menu Upsert payload (form create/update)
// ============================================================
// Mirror MenuUpsertInput (menus.schema.ts menuUpsertSchema). Controller pakai
// satu endpoint upsert: POST /menus (create) + PUT /menus/:id (update) keduanya
// parse menuUpsertSchema penuh (replace-children strategy di service). Dipakai
// MenuPage form di phase berikutnya.

/** REV 2.10: opsi dalam OptionGroup payload (optionSchema). */
export interface OptionUpsertPayload {
  label: string
  displayOrder: number
}

/** REV 2.10: grup opsi payload (optionGroupSchema). */
export interface OptionGroupUpsertPayload {
  name: string
  affectsVariant: boolean
  displayOrder: number
  options: OptionUpsertPayload[]
}

/** REV 2.10: varian payload (variantSchema). optionLabels = map
 * { groupName -> optionLabel } HANYA untuk grup affectsVariant=true. */
export interface MenuVariantUpsertPayload {
  optionLabels: Record<string, string>
  label: string
  price: number
  stockTargetMenuId: number | null
  /** REV 2.11: sumber modal untuk varian nonStock (lihat MenuVariant.costSourceMenuId). */
  costSourceMenuId?: number | null
  isActive: boolean
  displayOrder: number
}

/** REV 2.10: opsi pilihan slot paket payload (paketComponentSchema.choiceOptions). */
export interface PaketChoiceOptionUpsertPayload {
  label: string
  targetMenuId: number | null
  targetVariantId: number | null
  upcharge: number
}

/** REV 2.10: komponen paket payload (paketComponentSchema). */
export interface PaketComponentUpsertPayload {
  kind: 'fixed' | 'choice'
  label: string
  qty: number
  displayOrder: number
  targetMenuId: number | null
  targetVariantId: number | null
  choiceOptions: PaketChoiceOptionUpsertPayload[]
}

/** REV 2.10: payload upsert menu lengkap dengan catalog layer. Mirror
 * MenuUpsertInput. imageUrl + minStock optional/nullable. optionGroups/variants/
 * paketComponents default [] di backend (Zod) - form boleh kirim []. */
export interface MenuUpsertPayload {
  name: string
  category: string
  price: number
  imageUrl?: string | null
  kind: MenuKind
  posVisible: boolean
  stockType: StockType
  minStock?: number | null
  optionGroups: OptionGroupUpsertPayload[]
  variants: MenuVariantUpsertPayload[]
  paketComponents: PaketComponentUpsertPayload[]
  /** REV 2.11: harga modal / COGS (leaf/simple). Owner-only; backend log perubahan
   * ke MenuCostMovement. Variant/paket parent biarkan 0/null (modal di leaf). */
  cost?: number | null
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
  /** REV 2.10: varian terjual untuk menu kind=variant (null untuk simple/paket).
   * Optional: backend view mapper (toTransactionView) belum emit field ini -
   * akan ditambah di phase berikutnya bersama variantLabel + selections. */
  variantId?: number | null
  /** REV 2.10: label varian untuk display (kalau backend mengirimkannya). */
  variantLabel?: string | null
  /** REV 2.10: baris selection (slot paket + free-preference) - optional sampai
   * backend view mapper mengembalikannya. */
  selections?: TransactionItemSelection[]
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
  /** REV 2.12: PB1 ditanggung resto (0 kalau dibebankan ke pelanggan / nonaktif). */
  taxBorneAmount: number
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
  /** Harga per unit yang dipakai cart/subtotal. Untuk menu varian = harga varian
   * terpilih (bukan menu.price); simple/paket = menu.price. */
  price: number
  qty: number
  notes: string
  /** LEGACY (pre-REV 2.10): pilihan paket berbasis nama (SubOptionsModal). */
  subOptionsSelected: Record<string, string> | null
  /** REV 2.10: varian terpilih (menu kind=variant). null untuk simple/paket. */
  variantId?: number | null
  /** REV 2.10: label varian untuk display di cart row (mis. "Paha · Bakar"). */
  variantLabel?: string | null
  /** REV 2.10: pilihan per slot paket kind=choice. Key = slot label
   * (PaketComponent.label). Mirror OrderItemInput.paketChoices. */
  paketChoices?: Record<
    string,
    { targetMenuId: number; variantId?: number | null; chosenLabel: string }
  > | null
  /** REV 2.10: free-preference (grup affectsVariant=false, mis. Suhu). Tidak
   * pengaruh harga/stok - cuma display + dipersist sebagai TransactionItemSelection. */
  preferences?: { groupLabel: string; chosenLabel: string }[] | null
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
 * `isActive=false` artinya bank itu soft-deleted di master - UI render dengan
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

/** REV 2.6: entry untuk Settlement.preview.system - system totals dari
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
  /** REV 2.8.1: tipe stok menu (portion=tracked, linked=ikut menu lain, nonStock=tak di-track). */
  stockType: StockType
  /** null untuk menu non-portion (linked/nonStock). */
  currentQty: number | null
  minStock: number | null
  openingQtyToday: number | null
  openingQtyDate: string | null
  suggestedRestockMorning: number
  isLow: boolean
  updatedAt: string
  /** REV 2.8: timestamp aktivitas manual terbaru (restock/opname). null = belum pernah / non-portion. */
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
// REV 2.11 - COGS / Harga Modal per menu (audit log perubahan)
// ============================================================

export type MenuCostChangeReason = 'initialSet' | 'manualEdit'
export const COST_REASON_LABEL: Record<MenuCostChangeReason, string> = {
  initialSet: 'Set Awal',
  manualEdit: 'Penyesuaian Modal',
}
export interface MenuCostMovementView {
  id: number
  costBefore: number | null
  costAfter: number | null
  reason: MenuCostChangeReason
  note: string | null
  userId: number
  userName: string
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
