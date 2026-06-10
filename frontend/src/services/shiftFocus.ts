import type { Shift } from '@/types'

// Pure selector "shift yang perlu ditutup/disetor" — satu sumber kebenaran yang
// dipakai SettlementPage agar tidak drift dari gate POS & panel Dashboard.
//
// Prioritas:
//   1. Ada shift OPEN system-wide (closedAt=null, mungkin overdue) → itu yang
//      harus ditutup dulu. Berlaku untuk owner (tak punya shift sendiri) maupun
//      kasir. `active` berasal dari getActiveShifts() (key ['shifts','active']).
//   2. Tidak ada shift open → pakai shift terakhir (recent) untuk kasus settle
//      hari yang sudah closed tapi belum disetor.
//   3. Tidak ada keduanya → null (benar-benar tak ada yang perlu diproses).
export function pickShiftToSettle(active: Shift[], recent: Shift[]): Shift | null {
  if (active.length > 0) return active[0]
  return recent.length > 0 ? recent[0] : null
}
