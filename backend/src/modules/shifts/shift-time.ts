export interface RestoClock {
  dateOnly: Date;       // UTC-midnight Date untuk tanggal kalender resto-local
  minutesOfDay: number; // 0..1439 menit sejak tengah malam resto-local
}
export interface ShiftWindowSettings {
  timezone: string;
  pagiStart: number;   // menit
  changeover: number;  // menit
  malamEnd: number;    // menit; <= changeover berarti cross-midnight
}

export function parseHHMM(s: string): number {
  const parts = s.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  return h * 60 + m;
}

export function restoNow(timezone: string, now: Date = new Date()): RestoClock {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  const minute = Number(parts.minute);
  return {
    dateOnly: new Date(Date.UTC(year, month - 1, day)),
    minutesOfDay: hour * 60 + minute,
  };
}

export function isCrossMidnight(s: ShiftWindowSettings): boolean {
  return s.malamEnd <= s.changeover;
}

export function businessDateFor(s: ShiftWindowSettings, now: Date = new Date()): Date {
  const { dateOnly, minutesOfDay } = restoNow(s.timezone, now);
  if (isCrossMidnight(s) && minutesOfDay < s.malamEnd) {
    const prev = new Date(dateOnly);
    prev.setUTCDate(prev.getUTCDate() - 1);
    return prev;
  }
  return dateOnly;
}

/// REV 2.12: shift "basi/overdue" = sudah masuk business day baru DAN sesi hari baru
/// sudah dimulai (>= jam buka pagi). Overtime tengah malam (sebelum pagiStart) TIDAK
/// dianggap basi supaya kasir bisa menuntaskan tagihan tadi malam tanpa diganggu.
/// shiftDate & hasil businessDateFor sama-sama UTC-midnight Date → banding via getTime().
export function isShiftStale(
  shiftDate: Date,
  s: ShiftWindowSettings,
  now: Date = new Date(),
): boolean {
  const bizToday = businessDateFor(s, now);
  const { minutesOfDay } = restoNow(s.timezone, now);
  return bizToday.getTime() > shiftDate.getTime() && minutesOfDay >= s.pagiStart;
}

