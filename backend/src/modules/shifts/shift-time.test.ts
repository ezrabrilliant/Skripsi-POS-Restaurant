import { describe, it, expect } from 'vitest';
import { parseHHMM, restoNow, businessDateFor, isCrossMidnight, isShiftStale } from './shift-time';

describe('parseHHMM', () => {
  it('konversi HH:MM ke menit', () => {
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('07:00')).toBe(420);
    expect(parseHHMM('18:30')).toBe(1110);
    expect(parseHHMM('23:59')).toBe(1439);
  });
});

describe('restoNow', () => {
  it('hitung menit-of-day di Asia/Jakarta dari instant UTC', () => {
    const r = restoNow('Asia/Jakarta', new Date('2026-05-29T11:00:00Z')); // 18:00 WIB
    expect(r.minutesOfDay).toBe(18 * 60);
    expect(r.dateOnly.toISOString().substring(0, 10)).toBe('2026-05-29');
  });
  it('after-midnight WIB beda tanggal kalender dari UTC', () => {
    const r = restoNow('Asia/Jakarta', new Date('2026-05-29T17:30:00Z')); // 2026-05-30 00:30 WIB
    expect(r.minutesOfDay).toBe(30);
    expect(r.dateOnly.toISOString().substring(0, 10)).toBe('2026-05-30');
  });
});

describe('businessDateFor', () => {
  const s = { timezone: 'Asia/Jakarta', pagiStart: 420, changeover: 1080, malamEnd: 1380 }; // 07:00/18:00/23:00 no cross-midnight
  it('business day = tanggal resto-local untuk config non-cross-midnight', () => {
    const d = businessDateFor(s, new Date('2026-05-29T15:00:00Z')); // 22:00 WIB
    expect(d.toISOString().substring(0, 10)).toBe('2026-05-29');
  });
  it('cross-midnight: jam 00:30 WIB masih business day kemarin', () => {
    const cross = { ...s, malamEnd: 90 }; // 01:30 (<= changeover => cross-midnight)
    const d = businessDateFor(cross, new Date('2026-05-29T17:30:00Z')); // 00:30 WIB tgl 30
    expect(d.toISOString().substring(0, 10)).toBe('2026-05-29');
  });
});

describe('isCrossMidnight', () => {
  it('malamEnd <= changeover → true (cross-midnight config)', () => {
    expect(isCrossMidnight({ timezone: 'Asia/Jakarta', pagiStart: 420, changeover: 1080, malamEnd: 90 })).toBe(true);
  });
  it('malamEnd > changeover → false (same-day config)', () => {
    expect(isCrossMidnight({ timezone: 'Asia/Jakarta', pagiStart: 420, changeover: 1080, malamEnd: 1380 })).toBe(false);
  });
});

describe('isShiftStale', () => {
  // window resto realistis: 10:00 buka, 15:00 changeover, 22:00 tutup (tidak cross-midnight)
  const s = { timezone: 'Asia/Jakarta', pagiStart: 600, changeover: 900, malamEnd: 1320 };
  const d = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`); // UTC-midnight, sama bentuk dengan Shift.date

  it('shift kemarin, sekarang besok PAGI (>= jam buka) → basi (true)', () => {
    // shift.date = 2026-05-29; now = 2026-05-31 03:00Z = 10:00 WIB (>= pagiStart 600)
    expect(isShiftStale(d('2026-05-29'), s, new Date('2026-05-31T03:00:00Z'))).toBe(true);
  });

  it('shift kemarin, sekarang masih OVERTIME tengah malam (< jam buka) → belum basi (false)', () => {
    // now = 2026-05-30T18:30:00Z = 2026-05-31 01:30 WIB (minutesOfDay 90 < pagiStart 600)
    expect(isShiftStale(d('2026-05-30'), s, new Date('2026-05-30T18:30:00Z'))).toBe(false);
  });

  it('shift hari ini, sekarang siang hari yang sama → tidak basi (false)', () => {
    // now = 2026-05-31T05:00:00Z = 12:00 WIB, business day sama dengan shift.date
    expect(isShiftStale(d('2026-05-31'), s, new Date('2026-05-31T05:00:00Z'))).toBe(false);
  });
});
