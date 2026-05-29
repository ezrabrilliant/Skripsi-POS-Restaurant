// REV 2.8: helper waktu relatif untuk kolom "Terakhir di-stok" di halaman Stok.
// Bucket kasar (konteks POS — presisi detik tidak relevan). Absolut pakai
// formatDateTime dari utils.ts.

/** "baru saja / N menit/jam/hari/bulan lalu / belum pernah" (Indonesian). */
export function relativeTime(iso: string | null): string {
  if (!iso) return 'belum pernah'
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  if (diffMs < 60_000) return 'baru saja'
  const menit = Math.floor(diffMs / 60_000)
  if (menit < 60) return `${menit} menit lalu`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  const hari = Math.floor(jam / 24)
  if (hari < 30) return `${hari} hari lalu`
  const bulan = Math.floor(hari / 30)
  return `${bulan} bulan lalu`
}

/**
 * Apakah `iso` jatuh pada tanggal lokal yang sama dengan `ref` (default sekarang)?
 * Dipakai filter "status opname hari ini". Device kasir berjalan di WIB =
 * AppSetting.timezone Asia/Jakarta, jadi tanggal lokal device = tanggal bisnis.
 * JANGAN banding substring UTC — pecah dekat tengah malam WIB.
 */
export function isSameLocalDate(iso: string | null, ref: Date = new Date()): boolean {
  if (!iso) return false
  const d = new Date(iso)
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  )
}
