import { describe, it, expect } from 'vitest';
import { canOpenShift } from './shift-rules';

const S = { timezone: 'Asia/Jakarta', pagiStart: 420, changeover: 1080, malamEnd: 1380 }; // 07:00/18:00/23:00
const base = { settings: S, hasOpenShift: false, pagiOpenedToday: false };

describe('canOpenShift', () => {
  it('pagi sebelum changeover → ok', () => {
    expect(canOpenShift({ ...base, type: 'pagi', nowMinutes: 480 }).ok).toBe(true);
  });
  it('pagi jam 20:00 (lewat changeover) → tolak out_of_window', () => {
    const r = canOpenShift({ ...base, type: 'pagi', nowMinutes: 1200 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('out_of_window');
  });
  it('prep dini: pagi sebelum pagiStart tetap boleh', () => {
    expect(canOpenShift({ ...base, type: 'pagi', nowMinutes: 360 }).ok).toBe(true);
  });
  it('malam setelah changeover → ok', () => {
    expect(canOpenShift({ ...base, type: 'malam', nowMinutes: 1140 }).ok).toBe(true);
  });
  it('serah-terima dini: malam sebelum changeover boleh JIKA pagi sudah dibuka', () => {
    expect(canOpenShift({ ...base, type: 'malam', nowMinutes: 1020, pagiOpenedToday: true }).ok).toBe(true);
  });
  it('malam pagi-pagi tanpa pagi dibuka → tolak', () => {
    const r = canOpenShift({ ...base, type: 'malam', nowMinutes: 600 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('out_of_window');
  });
  it('single-active dilanggar → tolak single_active', () => {
    const r = canOpenShift({ ...base, type: 'pagi', nowMinutes: 480, hasOpenShift: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('single_active');
  });
  it('reopen pagi dalam window (no open shift) → ok walau pagi sudah pernah dibuka', () => {
    expect(canOpenShift({ ...base, type: 'pagi', nowMinutes: 660, pagiOpenedToday: true }).ok).toBe(true);
  });
  it('cross-midnight: malam jam 23:30 (config end 01:30) → ok', () => {
    const cross = { ...S, malamEnd: 90 };
    expect(canOpenShift({ ...base, settings: cross, type: 'malam', nowMinutes: 1410 }).ok).toBe(true);
  });
});
