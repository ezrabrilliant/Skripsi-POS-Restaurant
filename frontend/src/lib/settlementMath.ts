// Mirror backend `settlements/variance.ts`. Cash membandingkan fisik laci dengan
// (penjualan cash + modal awal); non-cash tetap fisik vs system.

/** Pembanding (expected) untuk satu metode pembayaran. */
export function settlementExpected(
  code: string,
  system: number,
  openingCashTotal: number,
): number {
  return code === 'cash' ? system + openingCashTotal : system
}
