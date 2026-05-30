// PaymentMethodFormModal - REV 2.6 create / edit metode pembayaran.
//
// Field:
//   - code         (text, immutable setelah create - read-only saat edit)
//   - label        (text, required)
//   - colorHex     (8 swatch preset, button group)
//   - iconName     (ALLOWED_PAYMENT_ICONS dari service, button group dengan
//                   render icon visual)
//   - requiresBank (checkbox)
//   - allowDineIn  (checkbox, default true)
//   - allowTakeaway (checkbox, default true)
//   - bankIds      (multi-checkbox, source dari banks aktif. Hanya ditampilkan
//                   kalau requiresBank=true)
//
// Submit logic:
//   - Create: paymentMethodService.create({ ...form, bankIds })
//   - Edit:   PATCH paymentMethodService.update(...) + sync junction (diff
//             bankIds → assign/unassign per delta untuk minimize round trips)
//
// Validasi UI:
//   - requiresBank=true + bankIds=[] → disable submit + hint warning.
//   - code (create only) wajib lowercase + alfanumerik + underscore (mirror
//     backend regex untuk fail-fast UX).
//
// Permission: page sudah di-gate owner-only.

import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import * as LucideIcons from 'lucide-react'
import { AlertCircle } from 'lucide-react'
import {
  paymentMethodService,
  ALLOWED_PAYMENT_ICONS,
  type PaymentIconName,
  type CreatePaymentMethodInput,
  type UpdatePaymentMethodInput,
} from '@/services/paymentMethodService'
import type { PaymentMethodView, BankView } from '@/types'
import { Dialog, Button, Input, Checkbox } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { cn } from '@/lib/utils'

interface Props {
  existing: PaymentMethodView | null
  allBanks: BankView[]
  onClose: () => void
  onSuccess: () => void
}

const COLOR_PRESETS = [
  '#1f7a4d', // primary green (cash)
  '#2563eb', // blue (EDC)
  '#9333ea', // purple (QRIS)
  '#16a34a', // success green
  '#dc2626', // red
  '#d97706', // amber
  '#ee4d2d', // shopee orange
  '#6366f1', // indigo
] as const

/** Mirror backend regex: lowercase alfanumerik + underscore, 1-32 char. */
const CODE_REGEX = /^[a-z0-9_]{1,32}$/

function resolveIcon(iconName: string) {
  const Icon = (LucideIcons as unknown as Record<
    string,
    React.ComponentType<{ size?: number; className?: string }>
  >)[iconName]
  return Icon ?? LucideIcons.CreditCard
}

interface FormState {
  code: string
  label: string
  colorHex: string
  iconName: PaymentIconName
  requiresBank: boolean
  allowDineIn: boolean
  allowTakeaway: boolean
  bankIds: number[]
}

export function PaymentMethodFormModal({ existing, allBanks, onClose, onSuccess }: Props) {
  const toast = useToast()

  const [form, setForm] = useState<FormState>({
    code: existing?.code ?? '',
    label: existing?.label ?? '',
    colorHex: existing?.colorHex ?? COLOR_PRESETS[0],
    iconName: (existing?.iconName as PaymentIconName) ?? 'CreditCard',
    requiresBank: existing?.requiresBank ?? false,
    allowDineIn: existing?.allowDineIn ?? true,
    allowTakeaway: existing?.allowTakeaway ?? true,
    bankIds: existing?.banks.map((b) => b.id) ?? [],
  })

  const isEdit = !!existing
  const activeBanks = allBanks.filter((b) => b.isActive)
  const codeInvalid = !isEdit && form.code.length > 0 && !CODE_REGEX.test(form.code)
  const needsBank = form.requiresBank && form.bankIds.length === 0
  const canSubmit =
    form.label.trim().length > 0 &&
    (isEdit || (form.code.length > 0 && !codeInvalid)) &&
    !needsBank

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit && existing) {
        // Sync bank junction via diff (assign delta baru, unassign yang hilang).
        const oldIds = new Set(existing.banks.map((b) => b.id))
        const newIds = new Set(form.bankIds)
        const toAdd = [...newIds].filter((id) => !oldIds.has(id))
        const toRemove = [...oldIds].filter((id) => !newIds.has(id))

        // URUTAN PENTING (REV 2.6 fix): assign DULU → update → unassign TERAKHIR.
        // Backend `updatePaymentMethod` menolak requiresBank=true kalau bank count
        // di DB masih 0. Kalau PATCH duluan (sebelum assign), QRIS yang awalnya
        // 0 bank langsung ditolak walau user sudah pilih bank di form. Assign
        // duluan memastikan count sudah benar saat flag requiresBank di-flip.
        // Unassign ditaruh terakhir supaya: (a) kalau requiresBank baru di-set
        // false, guard "minimal 1 bank" sudah tidak aktif; (b) kalau tetap true,
        // count sudah grown dari toAdd jadi tidak kena last-bank guard.
        for (const bankId of toAdd) {
          await paymentMethodService.assignBank(existing.id, bankId)
        }

        const patch: UpdatePaymentMethodInput = {
          label: form.label,
          colorHex: form.colorHex,
          iconName: form.iconName,
          requiresBank: form.requiresBank,
          allowDineIn: form.allowDineIn,
          allowTakeaway: form.allowTakeaway,
        }
        await paymentMethodService.update(existing.id, patch)

        for (const bankId of toRemove) {
          await paymentMethodService.unassignBank(existing.id, bankId)
        }
        return existing.id
      }

      // Create - kirim full payload termasuk bankIds (backend create + assign
      // atomic).
      const payload: CreatePaymentMethodInput = {
        code: form.code,
        label: form.label,
        colorHex: form.colorHex,
        iconName: form.iconName,
        requiresBank: form.requiresBank,
        allowDineIn: form.allowDineIn,
        allowTakeaway: form.allowTakeaway,
        bankIds: form.bankIds,
      }
      const created = await paymentMethodService.create(payload)
      return created.id
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Metode pembayaran diperbarui' : 'Metode pembayaran dibuat')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || mutation.isPending) return
    mutation.mutate()
  }

  const toggleBank = (bankId: number) => {
    setForm((prev) => ({
      ...prev,
      bankIds: prev.bankIds.includes(bankId)
        ? prev.bankIds.filter((id) => id !== bankId)
        : [...prev.bankIds, bankId],
    }))
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !mutation.isPending && onClose()}
      title={isEdit ? `Edit: ${existing.label}` : 'Tambah Metode Pembayaran'}
      description={
        isEdit
          ? 'Kode tidak bisa diubah untuk menjaga referensi historis dari transaksi.'
          : 'Kode unik (mis. shopeepay), label tampilan, warna + icon, dan aturan pemakaian.'
      }
      size="lg"
      preventOutsideClose={mutation.isPending}
      footer={
        <Button
          type="submit"
          form="pm-form"
          variant="primary"
          size="md"
          fullWidth
          disabled={!canSubmit}
          loading={mutation.isPending}
        >
          {isEdit ? 'Simpan Perubahan' : 'Buat Metode'}
        </Button>
      }
    >
      <form id="pm-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Row: code + label */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Kode (immutable)"
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
            disabled={isEdit}
            placeholder="cth: shopeepay"
            helper={
              isEdit
                ? 'Tidak bisa diubah.'
                : codeInvalid
                  ? undefined
                  : 'Lowercase + angka + underscore saja.'
            }
            error={codeInvalid ? 'Hanya huruf kecil, angka, underscore (max 32).' : undefined}
            required
          />
          <Input
            label="Label tampilan"
            type="text"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="cth: ShopeePay"
            required
          />
        </div>

        {/* Color picker */}
        <div>
          <label className="text-label text-neutral-700 block mb-1.5">Warna</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((color) => {
              const active = form.colorHex === color
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, colorHex: color })}
                  aria-pressed={active}
                  aria-label={`Pilih warna ${color}`}
                  className={cn(
                    'w-10 h-10 rounded-lg transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                    active
                      ? 'ring-2 ring-offset-2 ring-neutral-800 scale-110'
                      : 'hover:scale-105',
                  )}
                  style={{ backgroundColor: color }}
                />
              )
            })}
          </div>
        </div>

        {/* Icon picker */}
        <div>
          <label className="text-label text-neutral-700 block mb-1.5">Icon</label>
          <div className="flex flex-wrap gap-2">
            {ALLOWED_PAYMENT_ICONS.map((name) => {
              const Icon = resolveIcon(name)
              const active = form.iconName === name
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setForm({ ...form, iconName: name })}
                  aria-pressed={active}
                  aria-label={`Pilih icon ${name}`}
                  title={name}
                  className={cn(
                    'w-12 h-12 rounded-lg flex items-center justify-center transition-colors border-2',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                    active
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50',
                  )}
                >
                  <Icon size={22} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview chip */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 flex items-center gap-3">
          <span className="text-label text-neutral-600 shrink-0">Preview:</span>
          <div className="flex items-center gap-2.5 px-3 py-2 bg-white rounded-lg border border-neutral-200">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: form.colorHex }}
            >
              {(() => {
                const Icon = resolveIcon(form.iconName)
                return <Icon size={18} className="text-white" />
              })()}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-neutral-900 text-body-sm">
                {form.label || 'Label tampilan'}
              </div>
              <div className="text-caption text-neutral-500 font-mono">
                {form.code || 'code'}
              </div>
            </div>
          </div>
        </div>

        {/* Rules: allowDineIn / allowTakeaway / requiresBank */}
        <div className="space-y-2">
          <label className="text-label text-neutral-700 block">Aturan</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Checkbox
              label="Boleh dine-in"
              checked={form.allowDineIn}
              onCheckedChange={(v) => setForm({ ...form, allowDineIn: v })}
            />
            <Checkbox
              label="Boleh takeaway"
              checked={form.allowTakeaway}
              onCheckedChange={(v) => setForm({ ...form, allowTakeaway: v })}
            />
            <Checkbox
              label="Wajib pilih bank"
              checked={form.requiresBank}
              onCheckedChange={(v) =>
                setForm({ ...form, requiresBank: v, bankIds: v ? form.bankIds : [] })
              }
            />
          </div>
        </div>

        {/* Bank multi-select - hanya muncul kalau requiresBank=true */}
        {form.requiresBank && (
          <div className="space-y-2">
            <label className="text-label text-neutral-700 block">
              Bank yang diterima ({form.bankIds.length} dipilih)
            </label>
            {activeBanks.length === 0 ? (
              <div className="rounded-lg border border-warning-300 bg-warning-50 p-3 flex items-start gap-2 text-body-sm text-warning-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  Belum ada bank aktif. Tambahkan bank dulu di tab{' '}
                  <strong>Bank</strong> sebelum mengaktifkan opsi ini.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-lg border border-neutral-200 p-3 bg-neutral-50">
                {activeBanks.map((b) => (
                  <Checkbox
                    key={b.id}
                    label={b.name}
                    checked={form.bankIds.includes(b.id)}
                    onCheckedChange={() => toggleBank(b.id)}
                  />
                ))}
              </div>
            )}
            {needsBank && activeBanks.length > 0 && (
              <div className="text-caption text-warning-700 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Pilih minimal 1 bank kalau "Wajib pilih bank" diaktifkan.
              </div>
            )}
          </div>
        )}
      </form>
    </Dialog>
  )
}
