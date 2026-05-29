import { describe, it, expect } from 'vitest';
import { parseHHMM, restoNow, businessDateFor, isCrossMidnight } from './shift-time';

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
