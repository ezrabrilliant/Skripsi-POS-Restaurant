// Helper murni perhitungan rekonsiliasi settlement.
// REV (cash reconciliation): metode tunai (code === 'cash') membandingkan fisik laci
// dengan (penjualan cash + modal awal hari ini). Non-tunai tetap fisik vs system murni.
// Diskriminator 'cash' = konvensi project (sama dengan fitur kembalian).

/** Nilai pembanding (expected) untuk satu metode pembayaran. */
export function methodExpected(
  code: string,
  system: number,
  openingCashTotal: number,
): number {
  return code === 'cash' ? system + openingCashTotal : system;
}

/** Selisih = fisik (counted) − expected. */
export function methodVariance(
  code: string,
  counted: number,
  system: number,
  openingCashTotal: number,
): number {
  return counted - methodExpected(code, system, openingCashTotal);
}
