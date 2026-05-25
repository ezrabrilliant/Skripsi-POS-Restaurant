// REV 2.3 POSPage — orchestrator untuk POS flow.
// Layout: 2 column (menu grid + cart panel) di desktop, stacked dengan toggle
// mobile (cart sebagai Sheet bottom). Gate: kasir+owner+waiter authenticated.
// Waiter access fallback untuk kalau kasir tidak available. Wajib ada active
// shift (kalau tidak → CTA buka shift via /dashboard).

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart, Wallet, ArrowLeft } from 'lucide-react'
import MenuGrid from '@/components/MenuGrid'
import CartPanel from '@/components/CartPanel'
import SubOptionsModal from '@/components/SubOptionsModal'
import PaymentModal from '@/components/PaymentModal'
import { menuService } from '@/services/menuService'
import { shiftService } from '@/services/shiftService'
import { transactionService } from '@/services/transactionService'
import { useCartStore, cartSubtotal, cartItemCount } from '@/stores/cartStore'
import type { Menu, PaketSubOptions, Transaction } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Button, IconButton, Sheet } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

export default function POSPage() {
  const navigate = useNavigate()
  const { tableNumber: urlTable } = useParams<{ tableNumber?: string }>()
  const qc = useQueryClient()
  const toast = useToast()
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [paketMenuOpen, setPaketMenuOpen] = useState<{ menu: Menu; paket: PaketSubOptions } | null>(null)
  const [createdTransactionId, setCreatedTransactionId] = useState<number | null>(null)

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

  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: ['menus', 'pos'],
    queryFn: () => menuService.list({ activeOnly: true, includeStock: true }),
  })

  const { data: activeShift, isLoading: shiftLoading } = useQuery({
    queryKey: ['shift', 'active'],
    queryFn: () => shiftService.getActiveShift(),
  })

  const createMutation = useMutation({
    mutationFn: transactionService.create,
    onSuccess: (tx) => {
      toast.success(`Transaksi #${tx.id} dibuat`)
      qc.invalidateQueries({ queryKey: ['menus', 'pos'] })
      qc.invalidateQueries({ queryKey: ['cashierDashboard'] })
      cart.clearCart()
      setShowMobileCart(false)
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal membuat transaksi'),
  })

  const payMutation = useMutation({
    mutationFn: (input: {
      id: number
      paymentMethod: 'cash' | 'edc' | 'qris' | 'gojek' | 'grab' | 'transfer'
      paymentBank?: string
      discountAmount?: number
    }) => transactionService.pay(input.id, input),
    onSuccess: (tx) => {
      toast.success(`Pembayaran ${formatCurrency(tx.total)} berhasil`)
      cart.clearCart()
      setCreatedTransactionId(null)
      setShowMobileCart(false)
      qc.invalidateQueries({ queryKey: ['cashierDashboard'] })
      qc.invalidateQueries({ queryKey: ['ownerReport'] })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal proses pembayaran'),
  })

  const handleMenuClick = (menu: Menu) => {
    if (menu.subOptions && 'options' in menu.subOptions) {
      setPaketMenuOpen({ menu, paket: menu.subOptions })
      return
    }
    cart.addItem({
      menuId: menu.id,
      menuName: menu.name,
      price: menu.price,
      subOptionsSelected: null,
    })
  }

  const handleSubOptionsConfirm = (selection: Record<string, string>) => {
    if (!paketMenuOpen) return
    cart.addItem({
      menuId: paketMenuOpen.menu.id,
      menuName: paketMenuOpen.menu.name,
      price: paketMenuOpen.menu.price,
      subOptionsSelected: selection,
    })
    setPaketMenuOpen(null)
  }

  const buildCreatePayload = () => {
    if (!activeShift) return null
    return {
      shiftId: activeShift.id,
      orderType: cart.orderType,
      tableNumber: cart.orderType === 'dineIn' && cart.tableNumber ? cart.tableNumber : undefined,
      items: cart.items.map((it) => ({
        menuId: it.menuId,
        qty: it.qty,
        subOptionsSelected: it.subOptionsSelected ?? undefined,
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
        toast.success(`Transaksi #${tx.id} dibuat — lanjut bayar`)
        qc.invalidateQueries({ queryKey: ['menus', 'pos'] })
        setCreatedTransactionId(tx.id)
      },
    })
  }

  const handlePaymentConfirm = (data: {
    paymentMethod: 'cash' | 'edc' | 'qris' | 'gojek' | 'grab' | 'transfer'
    paymentBank?: string
    discountAmount: number
  }) => {
    if (!createdTransactionId) return
    payMutation.mutate({
      id: createdTransactionId,
      paymentMethod: data.paymentMethod,
      paymentBank: data.paymentBank,
      discountAmount: data.discountAmount,
    })
  }

  const totalItems = cartItemCount(cart.items)

  // Gate: belum buka shift
  if (!shiftLoading && !activeShift) {
    return (
      <div className="h-full flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-sm border border-neutral-200/60">
          <div className="w-14 h-14 bg-warning-100 text-warning-700 rounded-full mx-auto mb-3 flex items-center justify-center">
            <Wallet className="w-7 h-7" />
          </div>
          <h2 className="text-title font-semibold text-neutral-900 mb-1">Kasir belum dibuka</h2>
          <p className="text-body-sm text-neutral-600 mb-4">
            Buka shift kasir dengan modal awal lebih dulu sebelum menerima transaksi.
          </p>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={() => navigate('/dashboard')}
          >
            Ke Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Menu grid */}
      <div className="flex-1 min-h-0 flex flex-col">
        <header className="px-3 py-2.5 bg-white border-b border-neutral-200 flex items-center gap-2 pt-safe md:pt-2.5">
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
              Shift {activeShift?.type ?? '—'} · {activeShift?.cashierName ?? ''}
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
        />
      </div>

      {/* Cart FAB + Sheet mobile */}
      <div className="md:hidden fixed right-4 z-sticky" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 0.75rem)', zIndex: 20 }}>
        <IconButton
          label={`Buka keranjang (${totalItems} item)`}
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
          />
        </div>
      </Sheet>

      {/* SubOptions paket modal */}
      {paketMenuOpen && (
        <SubOptionsModal
          menu={paketMenuOpen.menu}
          paket={paketMenuOpen.paket}
          onConfirm={handleSubOptionsConfirm}
          onClose={() => setPaketMenuOpen(null)}
        />
      )}

      {/* Payment modal */}
      {createdTransactionId !== null && (
        <PaymentModal
          subtotal={cartSubtotal(cart.items)}
          onConfirm={handlePaymentConfirm}
          onClose={() => setCreatedTransactionId(null)}
          isSubmitting={payMutation.isPending}
        />
      )}
    </div>
  )
}
