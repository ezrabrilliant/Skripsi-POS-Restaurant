import type { ShiftWindowSettings } from './shift-time';
import { isCrossMidnight } from './shift-time';

export type ShiftKind = 'pagi' | 'malam';

export interface OpenCheckInput {
  type: ShiftKind;
  nowMinutes: number;
  settings: ShiftWindowSettings;
  hasOpenShift: boolean;
  pagiOpenedToday: boolean;
}
export interface OpenCheckResult {
  ok: boolean;
  reason?: 'single_active' | 'out_of_window';
}

function malamWithinWindow(now: number, s: ShiftWindowSettings): boolean {
  if (!isCrossMidnight(s)) return now < s.malamEnd;
  return now >= s.changeover || now < s.malamEnd;
}

export function canOpenShift(input: OpenCheckInput): OpenCheckResult {
  if (input.hasOpenShift) return { ok: false, reason: 'single_active' };
  const { type, nowMinutes: now, settings: s, pagiOpenedToday } = input;
  if (type === 'pagi') {
    return now < s.changeover ? { ok: true } : { ok: false, reason: 'out_of_window' };
  }
  const inWindow = malamWithinWindow(now, s);
  // Cross-midnight after-midnight arm (nowMinutes < malamEnd) only passes when pagiOpenedToday is true.
  // This is intentional and matches spec §6 - the caller computes pagiOpenedToday against the BUSINESS DAY
  // (businessDateFor maps after-midnight times to the prior business day), so in real operation pagi was
  // opened that business day and this resolves true.
  // Do NOT broaden this formula.
  const allowed = inWindow && (pagiOpenedToday || now >= s.changeover);
  return allowed ? { ok: true } : { ok: false, reason: 'out_of_window' };
}
