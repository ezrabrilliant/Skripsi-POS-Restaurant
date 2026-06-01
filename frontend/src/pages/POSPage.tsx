// REV 2.5 POSPage - orchestrator untuk POS flow dengan view/input mode multi-Pesanan.
//
// Mode UI (deduced from cart state + active orders + inputMode):
//   - viewMode: dineIn + tableNumber selected + activeOrders.length > 0 + !inputMode
//     → CartPanel render ActiveOrdersView read-only + tombol Tambah Pesanan/Bayar.
//   - addPesanan mode: viewMode false + activeOrders.length > 0 + dineIn
//     → CartPanel render cart input + tombol Batal/Submit Pesanan (for adding new Tx).
//   - inputNew mode: takeaway OR (dineIn + empty table)
//     → CartPanel render cart input + tombol Simpan/Bayar (existing behavior).
//
// Bayar flow (REV 2.12 - merge atomik):
//   - POSPage TIDAK lagi merge upfront. handlePayTable cuma resolve target Tx
//     (oldest) + kumpulkan candidate source IDs, lalu setPaymentTxId/Candidates.
//   - PaymentModal owns add/removePayment lifecycle + own query subscription, DAN
//     mengirim mergeSourceIds ke addPayment supaya merge terjadi atomik di dalam
//     $transaction backend (gagal bayar = merge ikut rollback, tidak ada stuck merge).
//   - Single Tx (candidate kosong) → addPayment tanpa merge.
//
// REV 2.3 shift-decoupling preserved: gate 3-case (0/1/2+ active shifts),
// payload TIDAK kirim shiftId - backend auto-resolve.

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart, Wallet, ArrowLeft, Info, AlertTriangle } from 'lucide-react'
import MenuGrid from '@/components/MenuGrid'
import CartPanel from '@/components/CartPanel'
import VariantPickerModal, { type VariantPickResult } from '@/components/VariantPickerModal'
import PaymentModal from '@/components/PaymentModal'
import OpenShiftDialog from '@/components/OpenShiftDialog'
import OverdueShiftGate from '@/components/OverdueShiftGate'
import { menuService } from '@/services/menuService'
import { shiftService } from '@/services/shiftService'
import { transactionService } from '@/services/transactionService'
import { useCartStore, cartItemCount } from '@/stores/cartStore'
import { useAuthStore } from '@/stores/authStore'
import type { Menu, Shift, Transaction, UserRole } from '@/types'
import { cn } from '@/lib/utils'
import { Button, IconButton, Sheet } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'

export default function POSPage() {
  const navigate = useNavigate()
  const { tableNumber: urlTable } = useParams<{ tableNumber?: string }>()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuthStore()
  const [showMobileCart, setShowMobileCart] = useState(false)
  // REV 2.10: menu varian/paket yang lagi dipilih via VariantPickerModal.
  const [pickerMenu, setPickerMenu] = useState<Menu | null>(null)
  const [showOpenShiftDialog, setShowOpenShiftDialog] = useState(false)
  // REV 2.4 state baru
  const [inputMode, setInputMode] = useState(false)
  // REV 2.5: payment target Tx + tableNumber. Diset oleh handleSubmitAndPay / handlePayTable
  // / handlePayOrder setelah optional merge selesai. PaymentModal kemudian owns
  // addPayment/removePayment lifecycle + own query subscription.
  const [paymentTxId, setPaymentTxId] = useState<number | null>(null)
  const [paymentTableNumber, setPaymentTableNumber] = useState<number | null>(null)
  // REV 2.5: candidate Tx IDs untuk multi-Pesanan picker di PaymentModal. Empty
  // array = no picker (single Tx pay). PaymentModal handle merge selected → addPayment
  // atomic - merge tidak dilakukan upfront supaya cancel tidak meninggalkan
  // merge state yang stuck di backend.
  const [paymentCandidates, setPaymentCandidates] = useState<number[]>([])

  const cart = useCartStore()

  // Jika datang dari /pos/:tableNumber, preset tableNumber + orderType=dineIn
  useEffect(() => {
    if (urlTable) {
      const n = Number(urlTable)
      if (Number.isInteger(n) && n >= 1 && n <= 9) {
        cart.setOrderType('dineIn')
        cart.setTableNumber(n)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTable])

  // REV 2.4: saat user pindah meja atau ganti orderType, reset inputMode HANYA
  // kalau cart masih kosong - supaya view mode bisa auto-engage di context baru.
  // KALAU cart ada items (user lagi build pesanan), JANGAN reset apapun: cart
  // persist + inputMode preserved. Build-then-assign UX: user bisa pilih menu
  // dulu, baru pilih meja, baru Simpan. Items TIDAK dibuang saat ganti context.
  useEffect(() => {
    if (cart.items.length === 0) {
      setInputMode(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.tableNumber, cart.orderType])

  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: ['menus', 'pos'],
    queryFn: () => menuService.list({ activeOnly: true, includeStock: true, includePopularity: true }),
  })

  const { data: activeShifts = [], isLoading: shiftLoading } = useQuery({
    queryKey: ['shifts', 'active'],
    queryFn: () => shiftService.getActiveShifts(),
    refetchInterval: 25_000,
    refetchOnMount: 'always',
  })
  // REV 2.3 shift-decoupling: pakai single active shift untuk header info + create payload.
  const singleActiveShift = activeShifts.length === 1 ? activeShifts[0]! : null

  // REV 2.4: query active orders per meja (untuk view mode dineIn). Dijalankan hanya
  // kalau orderType=dineIn + tableNumber selected.
  const { data: activeOrders = [] } = useQuery({
    queryKey: ['transactions', 'byTable', cart.tableNumber],
    queryFn: () => transactionService.listByTable(cart.tableNumber!, 'open'),
    enabled: cart.orderType === 'dineIn' && cart.tableNumber !== null,
  })

  // REV 2.4: query open takeaway transactions (untuk view mode takeaway). Dijalankan
  // hanya kalau orderType=takeaway. Setiap takeaway = independent Tx (TIDAK merge).
  const { data: openTakeaways = [] } = useQuery({
    queryKey: ['transactions', 'openTakeaway'],
    queryFn: () => transactionService.list({ status: 'open', orderType: 'takeaway' }),
    enabled: cart.orderType === 'takeaway',
  })

  // Derived mode: viewMode true → CartPanel render ActiveOrdersView (dineIn) atau
  // ActiveTakeawaysView (takeaway).
  const isDineInViewMode =
    cart.orderType === 'dineIn' && cart.tableNumber !== null && activeOrders.length > 0 && !inputMode
  const isTakeawayViewMode =
    cart.orderType === 'takeaway' && openTakeaways.length > 0 && !inputMode
  const isViewMode = isDineInViewMode || isTakeawayViewMode

  const createMutation = useMutation({
    mutationFn: transactionService.create,
    onSuccess: (tx) => {
      toast.success(`Tx #${tx.id} disimpan`)
      qc.invalidateQueries({ queryKey: ['menus', 'pos'] })
      qc.invalidateQueries({ queryKey: ['cashierDashboard'] })
      qc.invalidateQueries({ queryKey: ['transactions', 'byTable', cart.tableNumber] })
      qc.invalidateQueries({ queryKey: ['transactions', 'openTakeaway'] })
      // REV 2.5: invalidate global open-today supaya TablesPage grid + CombineTableModal
      // partner list refresh dengan Tx baru.
      qc.invalidateQueries({ queryKey: ['transactions', 'open-today'] })
      // REV 2.4: pakai clearItems supaya tableNumber/orderType tetap - bikin
      // view mode auto-engage setelah Tx baru muncul di activeOrders/openTakeaways.
      cart.clearItems()
      setInputMode(false)
      setShowMobileCart(false)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Gagal membuat transaksi')
      if (/buka shift|shift kasir aktif/i.test(err.message)) {
        qc.invalidateQueries({ queryKey: ['shifts', 'active'] })
      }
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: (input: { txId: number; itemId: number }) =>
      transactionService.deleteItem(input.txId, input.itemId),
    onSuccess: () => {
      toast.success('Item dihapus')
      qc.invalidateQueries({ queryKey: ['transactions', 'byTable', cart.tableNumber] })
      qc.invalidateQueries({ queryKey: ['transactions', 'openTakeaway'] })
      qc.invalidateQueries({ queryKey: ['menus', 'pos'] })
      // REV 2.5: backend auto-void Tx kalau remaining items=0 → Tx hilang dari
      // open list. Invalidate supaya TablesPage + CombineTableModal sync.
      qc.invalidateQueries({ queryKey: ['transactions', 'open-today'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal hapus item'),
  })

  // REV 2.4: update item qty + notes per item dari Pesanan open. Backend adjust
  // stock delta + audit log + recompute subtotal.
  const updateItemMutation = useMutation({
    mutationFn: (input: { txId: number; itemId: number; qty?: number; notes?: string | null }) =>
      transactionService.updateItem(input.txId, input.itemId, {
        qty: input.qty,
        notes: input.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', 'byTable', cart.tableNumber] })
      qc.invalidateQueries({ queryKey: ['transactions', 'openTakeaway'] })
      qc.invalidateQueries({ queryKey: ['menus', 'pos'] })
      // REV 2.5: subtotal change → refresh global open list (TablesPage tile + CombineTableModal).
      qc.invalidateQueries({ queryKey: ['transactions', 'open-today'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal update item'),
  })

  // REV 2.5: merge intra-table SEKARANG dipindah ke dalam PaymentModal (defer
  // sampai user confirm addPayment). POSPage cuma kirim target + candidate IDs.
  // Sebelumnya merge upfront → kalau user cancel modal, merge state stuck di
  // backend ("Source X sudah merged ke Y" saat retry).

  const handleMenuClick = (menu: Menu) => {
    // REV 2.10: variant/paket → buka VariantPickerModal; simple → addItem langsung.
    if (menu.kind === 'variant' || menu.kind === 'paket') {
      setPickerMenu(menu)
      return
    }
    // REV 2.4: menu click implisit = "tambah ke cart". Auto-switch ke input mode
    // supaya cart langsung visible (mengganti ActiveOrdersView/ActiveTakeawaysView
    // kalau lagi view mode). Build-then-assign UX.
    setInputMode(true)
    cart.addItem({
      menuId: menu.id,
      menuName: menu.name,
      price: menu.price,
      subOptionsSelected: null,
    })
  }

  // REV 2.10: VariantPickerModal confirm → addItem dengan varian/paket/preferences.
  const handlePickerConfirm = (result: VariantPickResult) => {
    if (!pickerMenu) return
    setInputMode(true)
    cart.addItem({
      menuId: result.menuId,
      menuName: pickerMenu.name,
      price: pickerMenu.price,
      unitPrice: result.unitPrice,
      variantId: result.variantId ?? null,
      variantLabel: result.variantLabel ?? null,
      paketChoices: result.paketChoices ?? null,
      preferences: result.preferences ?? null,
    })
    setPickerMenu(null)
  }

  const buildCreatePayload = () => {
    if (!singleActiveShift) return null
    // REV 2.3 shift-decoupling: payload TIDAK include shiftId - backend auto-resolve.
    // REV 2.4: include notes per item (kalau ada - kosong jadi undefined).
    // REV 2.10: map varian/paketChoices/preferences ke OrderItemInput.
    return {
      orderType: cart.orderType,
      tableNumber: cart.orderType === 'dineIn' && cart.tableNumber ? cart.tableNumber : undefined,
      items: cart.items.map((it) => ({
        menuId: it.menuId,
        qty: it.qty,
        subOptionsSelected: it.subOptionsSelected ?? undefined,
        notes: it.notes || undefined,
        variantId: it.variantId ?? undefined,
        paketChoices:
          it.paketChoices && Object.keys(it.paketChoices).length > 0
            ? it.paketChoices
            : undefined,
        preferences:
          it.preferences && it.preferences.length > 0 ? it.preferences : undefined,
      })),
    }
  }

  const handleSubmit = () => {
    const payload = buildCreatePayload()
    if (!payload) return
    createMutation.mutate(payload)
  }

  const handleSubmitAndPay = () => {
    const payload = buildCreatePayload()
    if (!payload) return
    createMutation.mutate(payload, {
      onSuccess: (tx: Transaction) => {
        toast.success(`Tx #${tx.id} dibuat - lanjut bayar`)
        qc.invalidateQueries({ queryKey: ['menus', 'pos'] })
        qc.invalidateQueries({ queryKey: ['transactions', 'byTable', cart.tableNumber] })
        // REV 2.5: open PaymentModal dengan Tx baru. PaymentModal owns rest of flow.
        setPaymentTxId(tx.id)
        setPaymentTableNumber(tx.tableNumber)
        // Jangan reset inputMode di sini - biarkan PaymentModal flow selesai dulu.
      },
    })
  }

  // REV 2.4: handler view mode → "Tambah Pesanan" button.
  // Transisi view → addPesanan: setInputMode(true). Cart items TIDAK di-clear -
  // build-then-assign UX preserve apapun yang user sudah pilih. Kalau cart memang
  // kosong, user mulai dari nol seperti biasa.
  const handleAddPesanan = () => {
    setInputMode(true)
  }

  // REV 2.4: handler addPesanan mode → "Batal" button.
  // Transisi addPesanan → view: clear items + inputMode=false (kembali ke read-only).
  const handleCancelInput = () => {
    cart.clearItems()
    setInputMode(false)
  }

  // REV 2.5: handler view mode → "Bayar (Semua)" button (dine-in).
  // TIDAK merge di sini - cuma resolve target Tx + collect candidate IDs untuk
  // picker di PaymentModal. Merge happens INSIDE PaymentModal pas user confirm
  // addPayment (atomic dengan pay). Kalau user cancel, no merge → no stuck state.
  const handlePayTable = () => {
    if (activeOrders.length === 0) return
    const sorted = [...activeOrders].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const target = sorted[0]!
    const candidates = sorted.slice(1).map((s) => s.id)
    setPaymentTxId(target.id)
    setPaymentTableNumber(target.tableNumber)
    setPaymentCandidates(candidates)
  }

  // REV 2.5: handler per-Tx Bayar - single Tx, no merge needed.
  // Dipakai oleh ActiveTakeawaysView (per-Tx takeaway pay) dan ActiveOrdersView
  // (per-Pesanan dineIn pay - customer pilih bayar 1 Pesanan saja, tidak full meja).
  // tableNumber derive dari tx.tableNumber: null untuk takeaway, integer untuk dineIn.
  // paymentCandidates kosong → PaymentModal tidak render picker (single Tx mode).
  const handlePayOrder = (tx: Transaction) => {
    setPaymentTxId(tx.id)
    setPaymentTableNumber(tx.tableNumber)
    setPaymentCandidates([])
  }

  // REV 2.4: handler hapus item dari Pesanan open. Confirm dulu (mengantisipasi
  // accidental click), lalu fire deleteItem mutation. Backend reverse stock +
  // audit log + recompute subtotal. List refresh via invalidate query.
  const handleDeleteItem = async (txId: number, itemId: number, itemLabel: string) => {
    const ok = await confirm({
      title: 'Hapus item ini?',
      description: `"${itemLabel}" akan dihapus dari Pesanan. Aksi ini tidak bisa di-undo.`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      tone: 'danger',
    })
    if (!ok) return
    deleteItemMutation.mutate({ txId, itemId })
  }

  // REV 2.4: handler update qty item - fire mutation langsung (no confirm karena
  // tombol +/- udah obvious aksi-nya).
  const handleUpdateItemQty = (txId: number, itemId: number, newQty: number) => {
    if (newQty < 1) return // safety; UI sudah disable - kalau qty=1
    updateItemMutation.mutate({ txId, itemId, qty: newQty })
  }

  // REV 2.4: handler update notes item - empty string = clear notes (jadi null di backend).
  const handleUpdateItemNotes = (txId: number, itemId: number, newNotes: string) => {
    updateItemMutation.mutate({ txId, itemId, notes: newNotes.trim() })
  }

  // REV 2.5: handler dipanggil PaymentModal saat Tx fully paid (cascade selesai).
  // Cleanup state UI + cart. Invalidate query handled di PaymentModal sendiri.
  const handlePaymentSuccess = () => {
    cart.clearItems()
    setPaymentTxId(null)
    setPaymentTableNumber(null)
    setPaymentCandidates([])
    setShowMobileCart(false)
    setInputMode(false)
  }

  const totalItems = cartItemCount(cart.items)

  // REV 2.3 shift-decoupling: gate 3-case per active shift count.
  if (!shiftLoading && activeShifts.length !== 1) {
    return (
      <>
        <ShiftGate
          activeShifts={activeShifts}
          role={user?.role ?? 'waiter'}
          onOpenShift={() => setShowOpenShiftDialog(true)}
          onGoToSettlement={() => navigate('/settlement')}
        />
        {showOpenShiftDialog && (
          <OpenShiftDialog
            onClose={() => setShowOpenShiftDialog(false)}
            onSuccess={() => {
              setShowOpenShiftDialog(false)
              qc.invalidateQueries({ queryKey: ['shifts', 'active'] })
            }}
          />
        )}
      </>
    )
  }

  // REV 2.12: shift tunggal yang aktif tapi sudah basi → blok input, arahkan tutup.
  const overdueShift = activeShifts.find((s) => s.isOverdue) ?? null
  if (!shiftLoading && overdueShift) {
    return <OverdueShiftGate shift={overdueShift} onGoToSettlement={() => navigate('/settlement')} />
  }

  return (
    <div className="h-full flex flex-col md:flex-row w-full">
      {/* Menu grid */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Header disamakan dgn token PageHeader (bar putih pinned) — tetap custom
            karena butuh leading back-button + layout 2 kolom kasir (bukan full-width). */}
        <header className="bg-white border-b border-neutral-200 px-3 sm:px-4 py-2.5 flex items-center gap-3 pt-safe md:pt-2.5">
          <IconButton
            label="Kembali"
            icon={<ArrowLeft />}
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="md:hidden"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-title text-neutral-900 leading-tight truncate">
              Input Order
            </h1>
            <p className="text-caption text-neutral-500 truncate">
              Shift {singleActiveShift?.type ?? '-'} · {singleActiveShift?.cashierName ?? ''}
            </p>
          </div>
        </header>
        <MenuGrid menus={menus} onMenuClick={handleMenuClick} loading={menusLoading} />
      </div>

      {/* Cart desktop */}
      <div className="hidden md:flex w-80 lg:w-96 flex-shrink-0">
        <CartPanel
          disabled={createMutation.isPending}
          onSubmit={handleSubmit}
          onSubmitAndPay={handleSubmitAndPay}
          isSubmitting={createMutation.isPending}
          viewMode={isViewMode}
          activeOrders={activeOrders}
          openTakeaways={openTakeaways}
          onAddPesanan={handleAddPesanan}
          onCancelInput={handleCancelInput}
          onPayTable={handlePayTable}
          onPayTakeaway={handlePayOrder}
          onPayOrder={handlePayOrder}
          onDeleteItem={handleDeleteItem}
          onUpdateItemQty={handleUpdateItemQty}
          onUpdateItemNotes={handleUpdateItemNotes}
          isDeleting={deleteItemMutation.isPending}
          isUpdatingItem={updateItemMutation.isPending}
        />
      </div>

      {/* Cart FAB + Sheet mobile */}
      <div
        className="md:hidden fixed right-4 z-sticky"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 0.75rem)', zIndex: 20 }}
      >
        <IconButton
          label={`Buka pesanan (${totalItems} item)`}
          icon={<ShoppingCart />}
          variant="solid"
          size="lg"
          onClick={() => setShowMobileCart(true)}
          badge={totalItems > 0 ? (totalItems > 9 ? '9+' : totalItems) : undefined}
          className="shadow-lg rounded-full"
        />
      </div>

      <Sheet
        open={showMobileCart}
        onOpenChange={setShowMobileCart}
        side="bottom"
        height="85vh"
        hideHeader
      >
        <div className="h-full">
          <CartPanel
            disabled={createMutation.isPending}
            onSubmit={handleSubmit}
            onSubmitAndPay={handleSubmitAndPay}
            isSubmitting={createMutation.isPending}
            viewMode={isViewMode}
            activeOrders={activeOrders}
            openTakeaways={openTakeaways}
            onAddPesanan={handleAddPesanan}
            onCancelInput={handleCancelInput}
            onPayTable={handlePayTable}
            onPayTakeaway={handlePayOrder}
            onPayOrder={handlePayOrder}
            onDeleteItem={handleDeleteItem}
            onUpdateItemQty={handleUpdateItemQty}
            onUpdateItemNotes={handleUpdateItemNotes}
            isDeleting={deleteItemMutation.isPending}
            isUpdatingItem={updateItemMutation.isPending}
          />
        </div>
      </Sheet>

      {/* REV 2.10: generic variant/paket picker modal */}
      {pickerMenu && (
        <VariantPickerModal
          menu={pickerMenu}
          onConfirm={handlePickerConfirm}
          onClose={() => setPickerMenu(null)}
        />
      )}

      {/* REV 2.5: Payment modal - stateful. POSPage kirim transactionId target +
          candidateSourceIds[] (kalau multi-Pesanan dineIn). PaymentModal handle
          picker UI + merge+addPayment atomic. Empty candidates = single Tx mode. */}
      {paymentTxId !== null && (
        <PaymentModal
          transactionId={paymentTxId}
          tableNumber={paymentTableNumber}
          candidateSourceIds={paymentCandidates}
          onClose={() => {
            setPaymentTxId(null)
            setPaymentTableNumber(null)
            setPaymentCandidates([])
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}

// REV 2.3 shift-decoupling: gate render 3-case per active shift count × role.
function ShiftGate({
  activeShifts,
  role,
  onOpenShift,
  onGoToSettlement,
}: {
  activeShifts: Shift[]
  role: UserRole
  onOpenShift: () => void
  onGoToSettlement: () => void
}) {
  const count = activeShifts.length

  if (count === 0) {
    const isCashier = role === 'cashier'
    return (
      <div className="h-full flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-sm border border-neutral-200/60">
          <div
            className={cn(
              'w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center',
              isCashier
                ? 'bg-warning-100 text-warning-700'
                : 'bg-info-50 text-info-700',
            )}
          >
            {isCashier ? <Wallet className="w-7 h-7" /> : <Info className="w-7 h-7" />}
          </div>
          <h2 className="text-title font-semibold text-neutral-900 mb-1">
            Belum ada shift kasir aktif
          </h2>
          <p className="text-body-sm text-neutral-600 mb-4">
            {isCashier
              ? 'Buka kasir dengan modal awal cash sebelum bisa menerima order.'
              : 'Kasir harus buka shift dulu sebelum order bisa dimasukkan. Hubungi salah satu kasir.'}
          </p>
          {isCashier && (
            <Button variant="primary" size="md" fullWidth onClick={onOpenShift}>
              Buka Kasir Sekarang
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Case C: 2+ active shifts → block input sampai salah satu ditutup.
  return (
    <div className="h-full flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-sm border border-warning-200">
        <div className="w-14 h-14 bg-warning-100 text-warning-700 rounded-full mx-auto mb-3 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-title font-semibold text-neutral-900 mb-1 text-center">
          Ada {count} shift aktif
        </h2>
        <p className="text-body-sm text-neutral-600 mb-3 text-center">
          Rekap fiskal jadi ambigu kalau ada lebih dari satu shift terbuka. Tutup salah satu
          shift dulu sebelum input order baru.
        </p>
        <ul className="text-body-sm text-neutral-700 space-y-1 mb-4">
          {activeShifts.map((s) => (
            <li key={s.id}>
              · Shift #{s.id} {s.type ? `(${s.type})` : ''} - {s.cashierName ?? 'kasir'}
            </li>
          ))}
        </ul>
        <Button variant="primary" size="md" fullWidth onClick={onGoToSettlement}>
          Ke Halaman Tutup Shift
        </Button>
      </div>
    </div>
  )
}
