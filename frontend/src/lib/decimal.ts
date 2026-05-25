/**
 * Decimal arithmetic helpers untuk perhitungan uang rupiah.
 *
 * Semua amount adalah integer rupiah (smallest unit). Tidak ada decimal
 * karena rupiah tidak punya sub-unit di praktik kasir. Float operations
 * (mis. base * 0.1) dirounding ke integer rupiah terdekat dengan
 * banker's rounding-safe `Math.round` (atau eksplisit floor/ceil
 * sesuai konteks).
 *
 * Asumsi: subtotal & discount selalu integer rupiah dari sumber data.
 * Backend Prisma juga simpan integer untuk transaction subtotal.
 */

export const PB1_RATE = 0.1

export interface PB1Calculation {
  /** Base = subtotal - discount, minimum 0 */
  base: number
  /** Tax PB1 = round(base * rate) */
  tax: number
  /** Total = base + tax */
  total: number
}

export function calculatePB1(
  subtotal: number,
  discount: number = 0,
  rate: number = PB1_RATE
): PB1Calculation {
  const safeSubtotal = Math.max(0, Math.round(subtotal))
  const safeDiscount = Math.max(0, Math.round(discount))
  const base = Math.max(0, safeSubtotal - safeDiscount)
  const tax = Math.round(base * rate)
  return {
    base,
    tax,
    total: base + tax,
  }
}

/**
 * Round to nearest rupiah (handles negative and float-precision drift).
 */
export function roundRupiah(amount: number): number {
  return Math.round(amount)
}

/**
 * Sum array of rupiah amounts safely (avoid float accumulator drift).
 */
export function sumRupiah(amounts: Array<number | string | null | undefined>): number {
  return amounts.reduce<number>((acc, val) => {
    if (val === null || val === undefined) return acc
    const n = typeof val === 'string' ? Number(val) : val
    if (!Number.isFinite(n)) return acc
    return acc + Math.round(n)
  }, 0)
}
