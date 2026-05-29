import type { AppSettings } from '@/services/settingsService'
import type { ShiftType } from '@/types'

export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}
export function restoNowMinutes(timezone: string, now: Date = new Date()): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(now).map((p) => [p.type, p.value]),
  )
  let h = Number(parts.hour); if (h === 24) h = 0
  return h * 60 + Number(parts.minute)
}
export function isAfterChangeover(s: AppSettings, now: Date = new Date()): boolean {
  return restoNowMinutes(s.timezone, now) >= parseHHMM(s.shiftChangeover)
}
interface ClientOpenInput { type: ShiftType; settings: AppSettings; hasOpenShift: boolean; pagiOpenedToday: boolean; now?: Date }
export function canOpenClient(i: ClientOpenInput): boolean {
  if (i.hasOpenShift) return false
  const now = restoNowMinutes(i.settings.timezone, i.now)
  const changeover = parseHHMM(i.settings.shiftChangeover)
  const malamEnd = parseHHMM(i.settings.shiftMalamEnd)
  const crossMidnight = malamEnd <= changeover
  if (i.type === 'pagi') return now < changeover
  const inMalam = crossMidnight ? (now >= changeover || now < malamEnd) : now < malamEnd
  return inMalam && (i.pagiOpenedToday || now >= changeover)
}
