// Helper tanggal. Kolom `date` pada basis data bertipe DATE (tanpa jam).
// Semua tanggal dinormalisasi ke tengah malam UTC agar query konsisten.

/** Tanggal hari ini dalam format YYYY-MM-DD (zona waktu lokal server). */
export function todayString(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Ubah string YYYY-MM-DD menjadi objek Date pada tengah malam UTC. */
export function toDateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

/** Format objek Date menjadi string YYYY-MM-DD. */
export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Geser tanggal (string YYYY-MM-DD) sebanyak `days` hari. */
export function addDays(s: string, days: number): string {
  const d = toDateOnly(s);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}
