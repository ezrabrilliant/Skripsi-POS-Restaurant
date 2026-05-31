// REV 2.5 PaymentModal - stateful, 2 mode (single tender / split tender) + Combine
// Tables overlay. Sebelumnya dumb (subtotal prop + onConfirm callback); sekarang owns
// query + addPayment/removePayment mutations untuk handle multi-slice payment flow.
//
// Props minimal: transactionId + tableNumber (untuk Combine button) + onClose +
// onSuccess. POSPage hanya pass id target Tx (sudah merged kalau multi-Pesanan).
//
// Mode determination:
//   - payments.length === 0 → default 'single'. Toggle visible.
//   - payments.length > 0   → forced 'split' (lock toggle, hidden).
//
// Discount lock (per backend addPayment superRefine):
//   - First slice: editable.
//   - Setelah slice pertama: disabled (display lock + value preserved dari first slice).
//
// Aggregate subtotal compute:
//   - Before first slice: target.subtotal + sum(mergedFromOpen.subtotal). Hitung FE.
//   - After first slice: backend sudah set target.total = effectiveTotal aggregate-based.
//
// Auto-close: useEffect watch transaction.status === 'paid' → setTimeout 600ms → onSuccess()
// supaya toast sempat tampil sebelum modal tutup.

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Receipt,
  CreditCard,
  Link2,
  Loader2,
  Trash2,
  Plus,
  Check,
  Unlink,
  Printer,
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import {
  type PaymentMethod,
  type PaymentMethodView,
  type Transaction,
  type TransactionPayment,
} from '@/types'
import { transactionService, type AddPaymentPayload, type MergePayload } from '@/services/transactionService'
import { paymentMethodService } from '@/services/paymentMethodService'
import { settingsService } from '@/services/settingsService'
import { formatCurrency, cn } from '@/lib/utils'
import { calculatePB1 } from '@/lib/decimal'
import { generateReceiptPdf } from '@/lib/receipt'
import {
  Dialog,
  Button,
  Input,
  Combobox,
  type ComboboxOption,
  Badge,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'
import CombineTableModal from './CombineTableModal'

/** Resolve nama icon lucide ke komponen React. Fallback CreditCard kalau
 * iconName tidak terdaftar (defensive - backend whitelist tapi data lama
 * atau method custom mungkin saja punya nilai berbeda). */
function resolveIcon(iconName: string): React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }> {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>>)[iconName]
  return Icon ?? CreditCard
}

interface PaymentModalProps {
  transactionId: number
  /** TableId untuk Combine Tables overlay. null = takeaway (combine button hidden). */
  tableNumber: number | null
  /** REV 2.5: Tx IDs di meja yang sama (selain target) yang BISA digabung untuk
   * dibayar bersama (multi-Pesanan picker). Empty = single Tx mode (no picker).
   * Default semua tercentang. User bisa uncheck untuk bayar subset saja.
   * Merge happens INSIDE submit flow (atomic dengan addPayment) - bukan upfront -
   * supaya cancel tidak meninggalkan merge state stuck di backend. */
  candidateSourceIds?: number[]
  onClose: () => void
  /** Dipanggil setelah Tx fully paid (status='paid'). */
  onSuccess: () => void
}

type Mode = 'single' | 'split'

export default function PaymentModal({
  transactionId,
  tableNumber,
  candidateSourceIds = [],
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const toast = useToast()
  const qc = useQueryClient()
  const confirm = useConfirm()

  // REV 2.6: payment methods fetched from /payment-methods master (owner-configurable).
  // Drop hardcoded PAYMENT_METHODS const. List terbatas (~6-8 entries) + jarang berubah
  // → staleTime 5 menit aman, refetchOnWindowFocus false.
  const methodsQuery = useQuery({
    queryKey: ['paymentMethods', 'active'],
    queryFn: () => paymentMethodService.list(false),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  // REV 2.6: app settings (PB1 toggle + rate). Dipakai untuk preview tax di breakdown
  // supaya konsisten dengan backend addPayment. Default OFF (resto tidak charge PB1).
  const { data: appSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.get,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
  // Rate fraction (0.1 = 10%). 0 kalau PB1 disabled → tax 0, total = base.
  const taxRate = appSettings?.taxEnabled ? appSettings.taxRate / 100 : 0

  // Query target Tx (subscribed - refetch via invalidate setelah mutation).
  // FIX: refetchOnMount 'always' supaya tiap kali modal dibuka, detail Tx target
  // selalu di-fetch ulang dari network - override global staleTime 5 menit (main.tsx).
  // Tanpa ini, reopen modal untuk Tx yang sama dalam 5 menit menyajikan snapshot
  // basi (mis. subtotal sebelum item target diedit/dihapus). Lihat CombineTableModal:91.
  const { data: transaction, isLoading: txLoading, isFetching: txFetching } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => transactionService.byId(transactionId),
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })

  // Query open Tx system-wide untuk derive mergedFrom (untuk aggregate subtotal display).
  // Lightweight - resto cuma punya 9 meja, max ~18 open Tx aktif.
  // FIX: query ini di-key per transactionId dan TIDAK pernah di-invalidate oleh POSPage
  // create/delete/updateItem mutations. Tanpa refetchOnMount 'always', reopen modal
  // (mis. setelah "ngecek" lalu nambah Pesanan) menyajikan daftar open-Tx basi → Pesanan
  // baru di meja yang sama hilang dari picker + aggregate (bug bayar 47k padahal 77k).
  const { data: openTxs = [], isFetching: openTxsFetching } = useQuery({
    queryKey: ['transactions', 'open-merge-source-of', transactionId],
    queryFn: () => transactionService.list({ status: 'open' }),
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })

  const mergedFromOpen = useMemo(
    () => openTxs.filter((t) => t.mergedIntoId === transactionId),
    [openTxs, transactionId],
  )

  // REV 2.5: candidate Tx (intra-meja Pesanan lain) untuk picker. Filter:
  //   - ID di candidateSourceIds prop (POSPage pass dari activeOrders)
  //   - mergedIntoId === null (skip yang sudah ter-merge, mereka di mergedFromOpen)
  const candidateTxs = useMemo(
    () =>
      openTxs.filter(
        (t) => candidateSourceIds.includes(t.id) && t.mergedIntoId === null,
      ),
    [openTxs, candidateSourceIds],
  )

  // Form state
  const [mode, setMode] = useState<Mode>('single')
  // REV 2.5: selection state untuk picker. Default semua candidates ter-centang
  // (common case: bayar full meja). Sync ulang kalau prop candidateSourceIds berubah.
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(
    () => new Set(candidateSourceIds),
  )
  useEffect(() => {
    setSelectedCandidates(new Set(candidateSourceIds))
  }, [candidateSourceIds])

  const selectedCandidateTxs = useMemo(
    () => candidateTxs.filter((t) => selectedCandidates.has(t.id)),
    [candidateTxs, selectedCandidates],
  )
  // REV 2.6: methodCode = string (code dari master). 'cash' fallback initial pakai
  // first available method setelah query resolve (lihat effect di bawah).
  const [methodCode, setMethodCode] = useState<PaymentMethod>('')
  const [bank, setBank] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [amount, setAmount] = useState(0)
  const [combineOpen, setCombineOpen] = useState(false)

  // Sync mode: kalau payments sudah ada → force 'split'.
  useEffect(() => {
    if (transaction && transaction.payments.length > 0 && mode !== 'split') {
      setMode('split')
    }
  }, [transaction, mode])

  // Hitung aggregate subtotal + sisa.
  // REV 2.5: aggregate = target + already-merged sources (mergedFromOpen) +
  // selected candidates from picker (will be merged on submit).
  const isFirstSlice = !transaction || transaction.payments.length === 0
  const aggregateSubtotal = useMemo(() => {
    if (!transaction) return 0
    if (isFirstSlice) {
      return (
        transaction.subtotal +
        mergedFromOpen.reduce((s, t) => s + t.subtotal, 0) +
        selectedCandidateTxs.reduce((s, t) => s + t.subtotal, 0)
      )
    }
    // After first slice: backend sudah set transaction.total aggregate-based.
    // REV 2.6: reverse-derive exact dari field tersimpan (rate-independent, aman
    // walau PB1 toggle berubah): subtotal = total - taxAmount + discountAmount.
    return transaction.total - transaction.taxAmount + transaction.discountAmount
  }, [transaction, mergedFromOpen, selectedCandidateTxs, isFirstSlice])

  // Effective discount (lock setelah first slice).
  const effectiveDiscount = isFirstSlice ? discountAmount : (transaction?.discountAmount ?? 0)

  const { tax, total, base } = useMemo(
    () => calculatePB1(aggregateSubtotal, effectiveDiscount, taxRate),
    [aggregateSubtotal, effectiveDiscount, taxRate],
  )

  const sumPayments = useMemo(
    () => (transaction?.payments ?? []).reduce((s, p) => s + p.amount, 0),
    [transaction],
  )
  const sisa = Math.max(0, total - sumPayments)
  const isPaid = transaction?.status === 'paid'

  // Default amount: tracking sisa di split mode. Single mode tidak pakai amount input.
  useEffect(() => {
    if (mode === 'split' && !isPaid) {
      setAmount(sisa)
    }
  }, [mode, sisa, isPaid])

  // REV 2.12: TIDAK auto-close saat lunas. Tampilkan layar sukses + tombol
  // "Simpan Struk"/"Selesai" (early-return isPaid di render). onSuccess dipanggil
  // saat user klik "Selesai".

  // REV 2.6: filter metode pembayaran dinamis berdasarkan flag master di backend:
  //   - isActive (sudah filtered di list(false) tapi double-check defensive)
  //   - allowDineIn / allowTakeaway sesuai orderType transaction
  // Sort by displayOrder ASC supaya owner control urutan visual.
  // allMethods stable reference via useMemo supaya tidak invalidate filteredMethods setiap render.
  const allMethods = useMemo<PaymentMethodView[]>(() => methodsQuery.data ?? [], [methodsQuery.data])
  const filteredMethods = useMemo<PaymentMethodView[]>(() => {
    if (!transaction) return []
    return allMethods
      .filter((m) => m.isActive)
      .filter((m) => (transaction.orderType === 'dineIn' ? m.allowDineIn : m.allowTakeaway))
      .sort((a, b) => a.displayOrder - b.displayOrder)
  }, [allMethods, transaction])

  // Auto-pick first available method saat query resolve / orderType change.
  useEffect(() => {
    if (!methodCode && filteredMethods.length > 0) {
      setMethodCode(filteredMethods[0].code)
    }
    // Reset kalau current methodCode tidak ada di filteredMethods (mis. switch dineIn↔takeaway).
    if (methodCode && filteredMethods.length > 0 && !filteredMethods.some((m) => m.code === methodCode)) {
      setMethodCode(filteredMethods[0].code)
      setBank('')
    }
  }, [methodCode, filteredMethods])

  const selectedMethod = useMemo(
    () => filteredMethods.find((m) => m.code === methodCode) ?? null,
    [filteredMethods, methodCode],
  )
  const needsBank = selectedMethod?.requiresBank ?? false

  // REV 2.6: bank options = closed list dari selectedMethod.banks (filter active).
  // Drop free-text input + localStorage recent-banks. Bank master controlled by owner.
  const bankOptions = useMemo<ComboboxOption[]>(() => {
    if (!selectedMethod) return []
    return selectedMethod.banks
      .filter((b) => b.isActive)
      .map((b) => ({ value: b.name, label: b.name }))
  }, [selectedMethod])

  // Mutations
  const addPayMutation = useMutation({
    mutationFn: (payload: AddPaymentPayload) =>
      transactionService.addPayment(transactionId, payload),
    onSuccess: (tx) => {
      if (tx.status === 'paid') {
        toast.success(`Pembayaran ${formatCurrency(tx.total)} berhasil`)
      } else {
        toast.success('Slice pembayaran ditambahkan')
      }
      // Invalidate Tx + dashboards + table view.
      qc.invalidateQueries({ queryKey: ['transaction', transactionId] })
      qc.invalidateQueries({ queryKey: ['transactions', 'open-merge-source-of', transactionId] })
      qc.invalidateQueries({ queryKey: ['transactions', 'byTable', tableNumber] })
      qc.invalidateQueries({ queryKey: ['transactions', 'open-today'] })
      qc.invalidateQueries({ queryKey: ['transactions', 'openTakeaway'] })
      qc.invalidateQueries({ queryKey: ['cashierDashboard'] })
      qc.invalidateQueries({ queryKey: ['ownerReport'] })
      qc.invalidateQueries({ queryKey: ['menus', 'pos'] })
      // Reset form fields untuk slice berikutnya (split mode).
      if (tx.status !== 'paid') {
        setBank('')
        // amount akan re-default ke sisa via effect
      }
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal proses pembayaran'),
  })

  const removePayMutation = useMutation({
    mutationFn: (paymentId: number) =>
      transactionService.removePayment(transactionId, paymentId),
    onSuccess: () => {
      toast.success('Slice pembayaran dihapus')
      qc.invalidateQueries({ queryKey: ['transaction', transactionId] })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal hapus slice'),
  })

  // REV 2.5: merge intra-meja candidates (selected dari picker) ke target.
  // Dipanggil INSIDE submit flow (atomic dengan addPayment) - bukan upfront -
  // supaya cancel modal tidak meninggalkan merge state stuck di backend.
  const mergeMutation = useMutation({
    mutationFn: (payload: MergePayload) => transactionService.merge(payload),
    onSuccess: () => {
      // Invalidate supaya TablesPage grid + CombineTableModal picker refresh -
      // source meja jadi kosong / candidate hilang dari list.
      qc.invalidateQueries({ queryKey: ['transactions', 'open-today'] })
      qc.invalidateQueries({ queryKey: ['transactions', 'open-merge-source-of', transactionId] })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal menggabung pesanan'),
  })

  // REV 2.5: unmerge - lepas source meja dari gabungan. Hanya valid kalau target
  // belum ada payment slice (aggregate belum locked). Sekaligus refetch open Tx
  // list supaya mergedFromOpen ter-update + tableNumber-nya muncul lagi di TablesPage.
  const unmergeMutation = useMutation({
    mutationFn: (sourceId: number) => transactionService.unmerge(sourceId),
    onSuccess: () => {
      toast.success('Meja dilepas dari gabungan')
      qc.invalidateQueries({ queryKey: ['transaction', transactionId] })
      qc.invalidateQueries({ queryKey: ['transactions', 'open-merge-source-of', transactionId] })
      qc.invalidateQueries({ queryKey: ['transactions', 'open-today'] })
      qc.invalidateQueries({ queryKey: ['transactions', 'byTable', tableNumber] })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal lepas merge'),
  })

  // Handlers
  // REV 2.5: konfirmasi terakhir sebelum mutate - safety net untuk mengurangi miss-click
  // kasir saat input cepat. Pesan kontekstual: include method + bank + diskon (single)
  // atau sisa-after + lunas hint (split). Sekali user click "Ya", payment ter-record
  // permanently di backend (cuma bisa di-remove via Trash button per slice di split mode).
  const handleSingleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!transaction || isPaid || !selectedMethod) return
    if (needsBank && !bank.trim()) return
    if (discountAmount > aggregateSubtotal) return
    const finalBank = needsBank ? bank.trim() : undefined
    const methodDisplay = `${selectedMethod.label}${finalBank ? ` · ${finalBank}` : ''}`
    const pesananCount = 1 + selectedCandidates.size
    const ok = await confirm({
      title: `Konfirmasi bayar ${formatCurrency(total)}?`,
      description: (
        <span>
          Metode: <strong>{methodDisplay}</strong>
          {discountAmount > 0 && (
            <>
              <br />
              Diskon: <strong>{formatCurrency(discountAmount)}</strong>
            </>
          )}
          {pesananCount > 1 && (
            <>
              <br />
              <strong>{pesananCount} pesanan</strong> akan digabung & ditandai lunas.
            </>
          )}
          {pesananCount === 1 && (
            <>
              <br />
              Transaksi akan ditandai <strong>lunas</strong> setelah dikonfirmasi.
            </>
          )}
        </span>
      ),
      confirmText: 'Ya, Bayar',
      cancelText: 'Cek Lagi',
    })
    if (!ok) return
    // REV 2.5: merge selected candidates DULU (atomic dengan payment intent).
    // Kalau merge gagal, payment skip. Kalau cancel sebelum konfirmasi, no API call.
    if (selectedCandidates.size > 0) {
      try {
        await mergeMutation.mutateAsync({
          sourceIds: Array.from(selectedCandidates),
          targetId: transactionId,
        })
      } catch {
        return // toast handled in mutation onError
      }
    }
    addPayMutation.mutate({
      method: selectedMethod.code,
      bank: finalBank,
      amount: total,
      discountAmount,
    })
  }

  const handleAddSlice = async (e: FormEvent) => {
    e.preventDefault()
    if (!transaction || isPaid || !selectedMethod) return
    if (amount <= 0 || amount > sisa) return
    if (needsBank && !bank.trim()) return
    if (isFirstSlice && discountAmount > aggregateSubtotal) return
    const finalBank = needsBank ? bank.trim() : undefined
    const methodDisplay = `${selectedMethod.label}${finalBank ? ` · ${finalBank}` : ''}`
    const willCloseTx = amount >= sisa
    const sisaAfter = Math.max(0, sisa - amount)
    const pesananCount = 1 + selectedCandidates.size
    const ok = await confirm({
      title: `Tambah pembayaran ${formatCurrency(amount)}?`,
      description: (
        <span>
          Metode: <strong>{methodDisplay}</strong>
          {isFirstSlice && discountAmount > 0 && (
            <>
              <br />
              Diskon: <strong>{formatCurrency(discountAmount)}</strong>
            </>
          )}
          {isFirstSlice && pesananCount > 1 && (
            <>
              <br />
              <strong>{pesananCount} pesanan</strong> akan digabung saat slice pertama ini.
            </>
          )}
          <br />
          {willCloseTx ? (
            <>
              Slice ini menutup sisa - transaksi akan menjadi <strong>lunas</strong>.
            </>
          ) : (
            <>
              Sisa setelah ini: <strong>{formatCurrency(sisaAfter)}</strong>
            </>
          )}
        </span>
      ),
      confirmText: willCloseTx ? 'Ya, Selesaikan' : 'Ya, Tambah',
      cancelText: 'Cek Lagi',
    })
    if (!ok) return
    // REV 2.5: merge selected candidates HANYA di first slice (sebelum payment
    // pertama). Slice ke-2+ tidak ada candidates lagi (aggregate sudah ter-commit
    // ke target.total). Picker auto-hide setelah first slice (isFirstSlice=false).
    if (isFirstSlice && selectedCandidates.size > 0) {
      try {
        await mergeMutation.mutateAsync({
          sourceIds: Array.from(selectedCandidates),
          targetId: transactionId,
        })
      } catch {
        return // toast handled in mutation onError
      }
    }
    addPayMutation.mutate({
      method: selectedMethod.code,
      bank: finalBank,
      amount,
      // discountAmount HANYA dikirim di first slice. Backend reject kalau slice ke-2+ kirim > 0.
      discountAmount: isFirstSlice ? discountAmount : undefined,
    })
  }

  const handleRemoveSlice = (paymentId: number) => {
    removePayMutation.mutate(paymentId)
  }

  const handleCombineSuccess = () => {
    setCombineOpen(false)
    qc.invalidateQueries({ queryKey: ['transaction', transactionId] })
    qc.invalidateQueries({ queryKey: ['transactions', 'open-merge-source-of', transactionId] })
    qc.invalidateQueries({ queryKey: ['transactions', 'open-today'] })
    qc.invalidateQueries({ queryKey: ['transactions', 'byTable', tableNumber] })
  }

  // REV 2.12: generate + unduh struk PDF dari transaksi yang sudah dibayar.
  // Identitas + tarif dari appSettings; label metode dari master payment_methods.
  const handlePrintReceipt = () => {
    if (!transaction) return
    generateReceiptPdf(transaction, {
      identity: appSettings
        ? {
            restaurantName: appSettings.restaurantName,
            restaurantAddress: appSettings.restaurantAddress,
            openingHours: appSettings.openingHours,
            restaurantPhone: appSettings.restaurantPhone,
            restaurantLogoUrl: appSettings.restaurantLogoUrl,
          }
        : null,
      taxRate: appSettings?.taxRate ?? 10,
      paymentLabel: (code) => allMethods.find((m) => m.code === code)?.label ?? code,
    })
  }

  // Submit disable conditions
  const submitting = addPayMutation.isPending || mergeMutation.isPending
  // FIX: pas first slice, aggregate + daftar candidate dihitung dari query transaction +
  // openTxs. Selama keduanya masih refetch on mount (refetchOnMount 'always'), angka yang
  // tampil masih dari cache & bisa basi - blokir submit dulu supaya kasir tidak meng-confirm
  // nominal stale (mis. 47k padahal 77k). Sub-detik di network normal. Slice ke-2+ tidak
  // terpengaruh (total sudah locked di Tx.total server-side saat first slice).
  const firstSliceDataStale = isFirstSlice && (txFetching || openTxsFetching)
  const singleSubmitDisabled =
    submitting ||
    firstSliceDataStale ||
    !selectedMethod ||
    (needsBank && !bank.trim()) ||
    discountAmount > aggregateSubtotal ||
    aggregateSubtotal <= 0

  const sliceSubmitDisabled =
    submitting ||
    firstSliceDataStale ||
    !selectedMethod ||
    amount <= 0 ||
    amount > sisa ||
    (needsBank && !bank.trim()) ||
    (isFirstSlice && discountAmount > aggregateSubtotal)

  // Render
  if (txLoading || !transaction || methodsQuery.isLoading) {
    return (
      <Dialog
        open
        onOpenChange={(o) => !o && onClose()}
        title="Pembayaran"
        size="md"
      >
        <div className="text-center py-8 text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      </Dialog>
    )
  }

  if (methodsQuery.isError) {
    return (
      <Dialog
        open
        onOpenChange={(o) => !o && onClose()}
        title="Pembayaran"
        size="md"
      >
        <div className="text-center py-8 text-danger-700 text-body-sm">
          Gagal memuat metode pembayaran. Coba refresh halaman.
        </div>
      </Dialog>
    )
  }

  // REV 2.12: layar sukses pasca-bayar (TIDAK auto-close). Simpan struk / Selesai.
  if (isPaid) {
    const change = sumPayments - transaction.total
    return (
      <Dialog
        open
        onOpenChange={(o) => !o && onSuccess()}
        title={
          <span className="inline-flex items-center gap-2">
            <Check className="w-5 h-5 text-success-600" />
            Pembayaran Berhasil
          </span>
        }
        description={
          <span className="tabular-nums">
            Tx #{transaction.id}
            {tableNumber !== null && ` · Meja ${tableNumber}`}
          </span>
        }
        size="md"
        footer={
          <div className="flex gap-2 w-full">
            <Button
              variant="secondary"
              size="lg"
              onClick={handlePrintReceipt}
              leftIcon={<Printer className="w-5 h-5" />}
            >
              Simpan Struk
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onSuccess}
              leftIcon={<Check className="w-5 h-5" />}
            >
              Selesai
            </Button>
          </div>
        }
      >
        <div className="py-4 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-success-600" />
          </div>
          <div>
            <p className="text-caption text-neutral-500">Total dibayar</p>
            <p className="text-headline font-bold text-neutral-900 tabular-nums">
              {formatCurrency(transaction.total)}
            </p>
          </div>
          {change > 0 && (
            <p className="text-body-sm text-neutral-600">Kembalian {formatCurrency(change)}</p>
          )}
          <p className="text-caption text-neutral-500">
            Simpan struk PDF ke perangkat lewat tombol di bawah.
          </p>
        </div>
      </Dialog>
    )
  }

  const modeToggleHidden = transaction.payments.length > 0
  const showCombineButton = tableNumber !== null && !isPaid

  return (
    <>
      <Dialog
        open
        onOpenChange={(o) => !o && onClose()}
        title={
          <span className="inline-flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary-600" />
            Pembayaran
            {mode === 'split' && (
              <Badge tone="primary" size="sm">
                Bayar Sebagian
              </Badge>
            )}
          </span>
        }
        description={
          <span className="tabular-nums">
            Tx #{transaction.id}
            {tableNumber !== null && ` · Meja ${tableNumber}`}
            {(() => {
              // REV 2.5: description text dinamis berdasar source meja.
              //   - All intra-meja → "+ N pesanan" (multi-Pesanan REV 2.4)
              //   - All inter-meja → "+ N meja digabung" (Combine Tables REV 2.5)
              //   - Mixed       → "+ N tagihan digabung" (generic)
              if (mergedFromOpen.length === 0) return null
              const intraCount = mergedFromOpen.filter(
                (s) => tableNumber !== null && s.tableNumber === tableNumber,
              ).length
              const interCount = mergedFromOpen.length - intraCount
              if (interCount === 0) return ` · + ${intraCount} pesanan`
              if (intraCount === 0) return ` · + ${interCount} meja digabung`
              return ` · ${mergedFromOpen.length} tagihan digabung`
            })()}
          </span>
        }
        size="md"
        preventOutsideClose={submitting || removePayMutation.isPending}
        footer={
          mode === 'single' ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              form="payment-single-form"
              type="submit"
              loading={submitting}
              disabled={singleSubmitDisabled}
            >
              {submitting
                ? 'Memproses…'
                : `Konfirmasi · ${formatCurrency(total)}`}
            </Button>
          ) : isPaid ? (
            <Button variant="primary" size="lg" fullWidth onClick={onSuccess}>
              <Check className="w-5 h-5" />
              Selesai
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              form="payment-slice-form"
              type="submit"
              loading={submitting}
              disabled={sliceSubmitDisabled}
            >
              <Plus className="w-5 h-5" />
              Tambah Pembayaran · {formatCurrency(amount)}
            </Button>
          )
        }
      >
        <div className="space-y-4">
          {/* Combine Tables + Mode toggle row */}
          {(showCombineButton || !modeToggleHidden) && (
            <div className="flex flex-wrap gap-2">
              {showCombineButton && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCombineOpen(true)}
                >
                  <Link2 className="w-4 h-4" />
                  Gabung Meja Lain
                </Button>
              )}
              {!modeToggleHidden && (
                <ModeToggle mode={mode} onChange={setMode} />
              )}
            </div>
          )}

          {/* REV 2.5: PesananPickerPanel - intra-meja multi-Pesanan picker.
              User pilih Pesanan mana yang dibayar bersama via checkbox. Default
              semua tercentang. Merge happens on submit (atomic dengan addPayment).
              Hanya tampil saat first slice + ada candidates un-merged. */}
          {transaction && isFirstSlice && candidateTxs.length > 0 && (
            <PesananPickerPanel
              targetTx={transaction}
              candidates={candidateTxs}
              selected={selectedCandidates}
              onToggle={(id) =>
                setSelectedCandidates((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
              onSelectAll={(all) => {
                if (all) setSelectedCandidates(new Set(candidateTxs.map((c) => c.id)))
                else setSelectedCandidates(new Set())
              }}
              locked={submitting}
            />
          )}

          {/* REV 2.5: MergedSourcesPanel - sources yang SUDAH merged via backend
              (umumnya dari Combine Tables inter-meja, atau intra leftover dari
              failed payment retry). Beda dari PesananPickerPanel (yang masih
              candidate, belum merged). Unlink available untuk lepas kalau salah. */}
          {mergedFromOpen.length > 0 && (
            <MergedSourcesPanel
              sources={mergedFromOpen}
              targetTableNumber={tableNumber}
              onUnmerge={(sourceId) => unmergeMutation.mutate(sourceId)}
              unmerging={unmergeMutation.isPending}
              locked={transaction.payments.length > 0 || isPaid}
            />
          )}

          {/* Sisa indicator - split mode only */}
          {mode === 'split' && (
            <div
              className={cn(
                'rounded-xl border p-3 tabular-nums',
                isPaid
                  ? 'bg-success-50 border-success-200'
                  : 'bg-primary-50/50 border-primary-100',
              )}
            >
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Total" value={formatCurrency(total)} tone="neutral" />
                <Stat
                  label="Sudah Bayar"
                  value={formatCurrency(sumPayments)}
                  tone="neutral"
                />
                <Stat
                  label={isPaid ? 'Lunas' : 'Sisa'}
                  value={formatCurrency(sisa)}
                  tone={isPaid ? 'success' : 'primary'}
                  emphasis
                />
              </div>
            </div>
          )}

          {/* Slice list - split mode only, kalau ada slices */}
          {mode === 'split' && transaction.payments.length > 0 && (
            <PaymentSlicesList
              slices={transaction.payments}
              methods={allMethods}
              onRemove={handleRemoveSlice}
              removing={removePayMutation.isPending}
              locked={isPaid}
            />
          )}

          {/* Form submit area - hidden saat sudah paid */}
          {!isPaid && (
            <>
              {mode === 'single' ? (
                <form id="payment-single-form" onSubmit={handleSingleSubmit} className="space-y-4">
                  <MethodGrid
                    methods={filteredMethods}
                    selectedCode={methodCode}
                    onChange={(m) => {
                      setMethodCode(m.code)
                      if (!m.requiresBank) setBank('')
                    }}
                  />
                  {needsBank && (
                    <div>
                      <Combobox
                        label={`Bank (${selectedMethod?.label})`}
                        value={bank}
                        onValueChange={setBank}
                        options={bankOptions}
                        placeholder="Pilih bank..."
                        searchPlaceholder="Cari nama bank..."
                        emptyText="Tidak ada bank cocok"
                        error={
                          bankOptions.length === 0
                            ? 'Belum ada bank aktif untuk metode ini. Hubungi owner.'
                            : undefined
                        }
                      />
                    </div>
                  )}
                  <Input
                    label="Diskon (opsional)"
                    type="number"
                    inputMode="numeric"
                    value={discountAmount || ''}
                    onChange={(e) =>
                      setDiscountAmount(Math.max(0, Number(e.target.value) || 0))
                    }
                    min={0}
                    max={aggregateSubtotal}
                    // step=100 (ratusan) - min unit mata uang Indonesia.
                    step={100}
                    placeholder="0"
                    error={
                      discountAmount > aggregateSubtotal
                        ? 'Diskon tidak boleh melebihi subtotal.'
                        : undefined
                    }
                    helper="Pakai untuk pelanggan langganan / promo manual."
                  />
                  <PaymentBreakdown
                    subtotal={aggregateSubtotal}
                    discount={discountAmount}
                    base={base}
                    tax={tax}
                    total={total}
                    taxRatePercent={appSettings?.taxEnabled ? appSettings.taxRate : 0}
                  />
                </form>
              ) : (
                <form id="payment-slice-form" onSubmit={handleAddSlice} className="space-y-4">
                  <MethodGrid
                    methods={filteredMethods}
                    selectedCode={methodCode}
                    onChange={(m) => {
                      setMethodCode(m.code)
                      if (!m.requiresBank) setBank('')
                    }}
                  />
                  {needsBank && (
                    <div>
                      <Combobox
                        label={`Bank (${selectedMethod?.label})`}
                        value={bank}
                        onValueChange={setBank}
                        options={bankOptions}
                        placeholder="Pilih bank..."
                        searchPlaceholder="Cari nama bank..."
                        emptyText="Tidak ada bank cocok"
                        error={
                          bankOptions.length === 0
                            ? 'Belum ada bank aktif untuk metode ini. Hubungi owner.'
                            : undefined
                        }
                      />
                    </div>
                  )}
                  <div>
                    <Input
                      label="Nominal Pembayaran"
                      type="number"
                      inputMode="numeric"
                      value={amount || ''}
                      onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                      // HTML5 number validation: nilai valid = (value - min) / step integer.
                      // min=100 + step=100 → boundary 100, 200, ..., 20000 ✓.
                      // Sebelumnya min=1 + step=100 → boundary 1, 101, ..., 19901, 20001
                      // → input 20000 reject. min=100 = pembayaran minimal Rp 100 (1 unit
                      // mata uang terkecil), masuk akal.
                      min={100}
                      max={sisa}
                      // step=100 - min unit mata uang Indonesia adalah ratusan (Rp 100).
                      // Tidak ada koin/uang puluhan/satuan.
                      step={100}
                      placeholder="0"
                      error={
                        amount > sisa
                          ? `Melebihi sisa Rp ${formatCurrency(sisa).replace('Rp', '').trim()}`
                          : undefined
                      }
                      autoFocus
                    />
                    {amount !== sisa && sisa > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmount(sisa)}
                        className="mt-1.5 text-caption text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline"
                      >
                        Isi sisa ({formatCurrency(sisa)})
                      </button>
                    )}
                  </div>
                  <Input
                    label="Diskon (opsional)"
                    type="number"
                    inputMode="numeric"
                    value={isFirstSlice ? (discountAmount || '') : (effectiveDiscount || '')}
                    onChange={(e) =>
                      setDiscountAmount(Math.max(0, Number(e.target.value) || 0))
                    }
                    min={0}
                    max={aggregateSubtotal}
                    // step=100 (ratusan) - min unit mata uang Indonesia.
                    step={100}
                    placeholder="0"
                    disabled={!isFirstSlice}
                    error={
                      isFirstSlice && discountAmount > aggregateSubtotal
                        ? 'Diskon tidak boleh melebihi subtotal.'
                        : undefined
                    }
                    helper={
                      isFirstSlice
                        ? 'Hanya bisa di-set saat pembayaran pertama.'
                        : 'Terkunci setelah pembayaran pertama.'
                    }
                  />
                  <PaymentBreakdown
                    subtotal={aggregateSubtotal}
                    discount={effectiveDiscount}
                    base={base}
                    tax={tax}
                    total={total}
                    taxRatePercent={appSettings?.taxEnabled ? appSettings.taxRate : 0}
                  />
                </form>
              )}
            </>
          )}
        </div>
      </Dialog>

      {/* Combine Tables overlay - PaymentModal sebagai target meja */}
      {combineOpen && tableNumber !== null && (
        <CombineTableModal
          targetTableId={tableNumber}
          onClose={() => setCombineOpen(false)}
          onSuccess={handleCombineSuccess}
        />
      )}
    </>
  )
}

// ============================================================
// Sub-components
// ============================================================

function MergedSourcesPanel({
  sources,
  targetTableNumber,
  onUnmerge,
  unmerging,
  locked,
}: {
  sources: Transaction[]
  targetTableNumber: number | null
  onUnmerge: (sourceId: number) => void
  unmerging: boolean
  locked: boolean
}) {
  // Pisah intra-meja (Add Round REV 2.4 - multi-Pesanan di meja yang sama) vs
  // inter-meja (Combine Tables REV 2.5 - gabung dari meja berbeda). Backend
  // mergeBills dipakai untuk dua use case, tapi UX label harus beda supaya
  // user tidak bingung ("Tagihan gabungan dari Meja 8 ke Meja 8" = misleading).
  const intraSources = sources.filter(
    (s) => targetTableNumber !== null && s.tableNumber === targetTableNumber,
  )
  const interSources = sources.filter(
    (s) => targetTableNumber === null || s.tableNumber !== targetTableNumber,
  )

  return (
    <div className="space-y-2">
      {intraSources.length > 0 && (
        <SourcesSection
          title={`Pesanan tambahan di meja ini (${intraSources.length})`}
          sources={intraSources}
          rowLabel={(s) =>
            `Pesanan tambahan${s.tableNumber === null ? ' (takeaway)' : ''}`
          }
          unlinkHint="kembalikan jadi pesanan terpisah"
          onUnmerge={onUnmerge}
          unmerging={unmerging}
          locked={locked}
        />
      )}
      {interSources.length > 0 && (
        <SourcesSection
          title={`Tagihan gabungan dari meja lain (${interSources.length})`}
          sources={interSources}
          rowLabel={(s) => (s.tableNumber !== null ? `Meja ${s.tableNumber}` : 'Takeaway')}
          unlinkHint={
            targetTableNumber !== null
              ? `lepas dari gabungan Meja ${targetTableNumber}`
              : 'lepas dari gabungan'
          }
          onUnmerge={onUnmerge}
          unmerging={unmerging}
          locked={locked}
        />
      )}
    </div>
  )
}

function SourcesSection({
  title,
  sources,
  rowLabel,
  unlinkHint,
  onUnmerge,
  unmerging,
  locked,
}: {
  title: string
  sources: Transaction[]
  rowLabel: (s: Transaction) => string
  unlinkHint: string
  onUnmerge: (sourceId: number) => void
  unmerging: boolean
  locked: boolean
}) {
  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-label text-primary-800">{title}</p>
        {locked && (
          <span className="text-caption text-neutral-500 italic">
            Terkunci (sudah ada pembayaran)
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {sources.map((s) => {
          const label = rowLabel(s)
          return (
            <li
              key={s.id}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-primary-100"
            >
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-medium text-neutral-900 inline-flex items-center gap-2">
                  {label}
                  <Badge tone="neutral" size="sm">
                    Tx #{s.id}
                  </Badge>
                  <span className="text-caption text-neutral-500">
                    {s.items.length} item
                  </span>
                </p>
              </div>
              <span className="text-body-sm font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
                {formatCurrency(s.subtotal)}
              </span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => onUnmerge(s.id)}
                  disabled={unmerging}
                  aria-label={`Lepas ${label} - ${unlinkHint}`}
                  title={`Lepas ${label} - ${unlinkHint}`}
                  className={cn(
                    'h-8 w-8 inline-flex items-center justify-center rounded-md text-neutral-500 transition-colors',
                    'hover:bg-warning-50 hover:text-warning-700 active:bg-warning-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500/40',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PesananPickerPanel({
  targetTx,
  candidates,
  selected,
  onToggle,
  onSelectAll,
  locked,
}: {
  targetTx: Transaction
  candidates: Transaction[]
  selected: Set<number>
  onToggle: (id: number) => void
  onSelectAll: (all: boolean) => void
  locked: boolean
}) {
  // Sequence number per meja: sort target + candidates by createdAt asc, indexOf+1.
  const allByTime = [targetTx, ...candidates].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )
  const seqOf = (txId: number) =>
    allByTime.findIndex((t) => t.id === txId) + 1

  const allSelected =
    candidates.length > 0 && candidates.every((c) => selected.has(c.id))
  const noneSelected = candidates.every((c) => !selected.has(c.id))
  const selectedCount = 1 + selected.size // target always counts
  const totalCount = 1 + candidates.length

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="text-label text-primary-800">
          Pilih pesanan untuk dibayar ({selectedCount}/{totalCount})
        </p>
        {!locked && candidates.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectAll(!allSelected)}
            className="text-caption font-medium text-primary-700 hover:text-primary-800 hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 rounded px-0.5"
          >
            {allSelected ? 'Hapus semua centang' : noneSelected ? 'Pilih semua' : 'Pilih semua'}
          </button>
        )}
      </div>
      <ul className="space-y-1.5">
        {/* Target row - always checked, locked. Selalu jadi penerima payment. */}
        <PesananPickerRow
          tx={targetTx}
          seq={seqOf(targetTx.id)}
          checked
          locked={true}
          lockReason="target pembayaran"
          onToggle={() => {}}
        />
        {/* Candidate rows - toggleable */}
        {candidates.map((c) => (
          <PesananPickerRow
            key={c.id}
            tx={c}
            seq={seqOf(c.id)}
            checked={selected.has(c.id)}
            locked={locked}
            onToggle={() => onToggle(c.id)}
          />
        ))}
      </ul>
      {!locked && (
        <p className="text-caption text-neutral-500">
          Pesanan yang tidak dicentang tetap terbuka di meja ini & bisa dibayar terpisah.
        </p>
      )}
    </div>
  )
}

function PesananPickerRow({
  tx,
  seq,
  checked,
  locked,
  lockReason,
  onToggle,
}: {
  tx: Transaction
  seq: number
  checked: boolean
  locked: boolean
  lockReason?: string
  onToggle: () => void
}) {
  const disabled = locked
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onToggle()}
        className={cn(
          'w-full flex items-center gap-2 p-2.5 rounded-lg border transition-colors text-left',
          checked
            ? 'bg-white border-primary-300'
            : 'bg-neutral-50/60 border-neutral-200/60 hover:bg-neutral-50',
          disabled && 'cursor-not-allowed opacity-90',
          !disabled && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'h-[18px] w-[18px] shrink-0 rounded-[4px] border flex items-center justify-center transition-colors',
            checked
              ? 'bg-primary-600 border-primary-600 text-white'
              : 'bg-white border-neutral-300',
            disabled && checked && 'bg-primary-500 border-primary-500',
          )}
        >
          {checked && <Check className="h-3 w-3" strokeWidth={3.5} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-neutral-900 inline-flex items-center gap-2 flex-wrap">
            Pesanan #{seq}
            <Badge tone="neutral" size="sm">
              Tx #{tx.id}
            </Badge>
            <span className="text-caption text-neutral-500">
              {tx.items.length} item
            </span>
          </p>
          {lockReason && (
            <p className="text-caption text-neutral-500 italic mt-0.5">{lockReason}</p>
          )}
        </div>
        <span className="text-body-sm font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
          {formatCurrency(tx.subtotal)}
        </span>
      </button>
    </li>
  )
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Mode pembayaran"
      className="inline-flex rounded-lg border border-neutral-300 bg-white p-0.5"
    >
      {(['single', 'split'] as const).map((m) => {
        const active = mode === m
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={cn(
              'min-h-[36px] px-3 rounded-md text-body-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
              active
                ? 'bg-primary-50 text-primary-800 ring-1 ring-primary-500/40'
                : 'text-neutral-600 hover:bg-neutral-50',
            )}
          >
            {m === 'single' ? 'Bayar Penuh' : 'Bayar Sebagian'}
          </button>
        )
      })}
    </div>
  )
}

function MethodGrid({
  methods,
  selectedCode,
  onChange,
}: {
  /** REV 2.6: filtered list dari /payment-methods master (isActive + allowDineIn/Takeaway). */
  methods: PaymentMethodView[]
  selectedCode: string
  onChange: (m: PaymentMethodView) => void
}) {
  if (methods.length === 0) {
    return (
      <div className="rounded-xl border border-warning-200 bg-warning-50/60 p-3 text-body-sm text-warning-800">
        Belum ada metode pembayaran aktif untuk tipe pesanan ini. Hubungi owner.
      </div>
    )
  }
  return (
    <div>
      <p className="text-label text-neutral-700 mb-2">Metode Pembayaran</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {methods.map((m) => {
          const Icon = resolveIcon(m.iconName)
          const active = selectedCode === m.code
          // Gunakan colorHex dari master untuk accent ring + icon tint kalau active.
          return (
            <button
              key={m.code}
              type="button"
              onClick={() => onChange(m)}
              aria-pressed={active}
              className={cn(
                'min-h-[72px] py-3 px-2 rounded-lg border text-body-sm font-medium transition-colors',
                'flex flex-col items-center justify-center gap-1.5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                active
                  ? 'border-primary-500 text-primary-800 ring-1 ring-primary-500/40'
                  : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100',
              )}
              style={
                active
                  ? { backgroundColor: `${m.colorHex}15`, borderColor: m.colorHex }
                  : undefined
              }
            >
              <Icon
                className={cn('w-5 h-5', !active && 'text-neutral-500')}
                style={active ? { color: m.colorHex } : undefined}
              />
              <span className="leading-tight text-center">{m.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PaymentSlicesList({
  slices,
  methods,
  onRemove,
  removing,
  locked,
}: {
  slices: TransactionPayment[]
  /** REV 2.6: list payment methods master untuk lookup label + icon per slice. */
  methods: PaymentMethodView[]
  onRemove: (paymentId: number) => void
  removing: boolean
  locked: boolean
}) {
  return (
    <div>
      <p className="text-label text-neutral-700 mb-2">
        Riwayat pembayaran ({slices.length})
      </p>
      <div className="space-y-2">
        {slices.map((slice, idx) => {
          const meta = methods.find((m) => m.code === slice.method)
          const Icon = resolveIcon(meta?.iconName ?? 'CreditCard')
          const label = meta?.label ?? slice.method
          return (
            <div
              key={slice.id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-50/80 border border-neutral-200/60"
            >
              <span className="h-7 w-7 shrink-0 rounded-md bg-white border border-neutral-200 inline-flex items-center justify-center text-primary-600">
                <Icon className="w-3.5 h-3.5" style={meta ? { color: meta.colorHex } : undefined} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-medium text-neutral-900 inline-flex items-center gap-2">
                  #{idx + 1} · {label}
                  {slice.bank && (
                    <Badge tone="neutral" size="sm">
                      {slice.bank}
                    </Badge>
                  )}
                </p>
                <p className="text-caption text-neutral-500">
                  Oleh {slice.recordedByName}
                </p>
              </div>
              <span className="text-body-sm font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
                {formatCurrency(slice.amount)}
              </span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => onRemove(slice.id)}
                  disabled={removing}
                  aria-label={`Hapus pembayaran #${idx + 1}`}
                  className={cn(
                    'h-8 w-8 inline-flex items-center justify-center rounded-md text-danger-600 transition-colors',
                    'hover:bg-danger-50 active:bg-danger-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/40',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PaymentBreakdown({
  subtotal,
  discount,
  base,
  tax,
  total,
  taxRatePercent,
}: {
  subtotal: number
  discount: number
  base: number
  tax: number
  total: number
  /** REV 2.6: 0 = PB1 nonaktif (baris pajak + "setelah diskon" disembunyikan). */
  taxRatePercent: number
}) {
  const taxActive = taxRatePercent > 0
  return (
    <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-3.5 space-y-1.5 tabular-nums">
      <Row label="Subtotal" value={formatCurrency(subtotal)} muted />
      {discount > 0 && (
        <Row label="Diskon" value={`− ${formatCurrency(discount)}`} muted />
      )}
      {taxActive && (
        <>
          <Row label="Setelah diskon" value={formatCurrency(base)} muted />
          <Row label={`PB1 ${taxRatePercent}%`} value={formatCurrency(tax)} muted />
        </>
      )}
      <div className="pt-2 mt-1 border-t border-primary-200">
        <Row label="Total Bayar" value={formatCurrency(total)} bold />
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string
  value: string
  muted?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span
        className={cn(
          'text-body-sm',
          muted ? 'text-neutral-600' : 'text-neutral-900',
          bold && 'font-semibold',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'text-body',
          bold ? 'font-bold text-primary-700 text-title' : 'font-medium text-neutral-900',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string
  value: string
  tone: 'neutral' | 'primary' | 'success'
  emphasis?: boolean
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success-700'
      : tone === 'primary'
        ? 'text-primary-700'
        : 'text-neutral-800'
  return (
    <div>
      <p className="text-caption text-neutral-500">{label}</p>
      <p
        className={cn(
          'tabular-nums',
          emphasis ? 'text-title font-bold' : 'text-body font-semibold',
          toneClass,
        )}
      >
        {value}
      </p>
    </div>
  )
}
