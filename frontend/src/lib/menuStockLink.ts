// REV 2.9 (B2): jembatan navigasi Menu → Stok.
//
// Konteks linkage (lihat types/index.ts):
//  - Menu `portion`  : punya stok sendiri → fokus baris stok = menu.id.
//  - Menu `linked`   : `subOptions.stockTarget` menyimpan NAMA menu target
//                      (string, bukan id). Stok yang berkurang adalah stok menu
//                      target itu. Untuk deep-link `focusMenuId` kita harus
//                      resolve nama → id dengan mencari di daftar menu.
//  - Menu `nonStock` : tidak melacak stok → tidak ada tautan.
//
// Karena `stockTarget` berupa nama bebas, resolusi bisa gagal (typo / nama
// berubah) atau ambigu (dua menu bernama sama). Saat tak terselesaikan kita
// jatuh ke pencarian (`?q=nama`) supaya user tetap diarahkan ke kandidat yang
// relevan, bukan halaman kosong.

import type { Menu } from '@/types'

export interface MenuStockLink {
  /** Path tujuan (dipakai sebagai `to` pada <Link>). */
  to: string
  /** Label tombol kontekstual. */
  label: string
  /** True bila resolusi nama gagal/ambigu → jatuh ke pencarian `?q=`. */
  isFallback: boolean
}

function portionFocusPath(menuId: number): string {
  return `/stock?${new URLSearchParams({ tab: 'portion', focusMenuId: String(menuId) })}`
}

function portionSearchPath(name: string): string {
  return `/stock?${new URLSearchParams({ tab: 'portion', q: name })}`
}

/**
 * ===== TITIK KONTRIBUSI (learning mode) =====
 * Resolusi nama `stockTarget` (menu `linked`) → id menu target.
 *
 * Keputusan yang dibentuk fungsi ini:
 *  1. Strategi pencocokan nama — saat ini: trim + case-insensitive, cocok PERSIS.
 *     (Nama menu sudah dibersihkan dari prefiks "Es" di REV 2.4, jadi exact match
 *     aman; substring match berisiko salah-tunjuk "Teh" → "Teh Manis".)
 *  2. Penanganan duplikat — bila ADA LEBIH DARI SATU menu dengan nama sama,
 *     anggap ambigu → kembalikan null agar pemanggil pakai fallback pencarian.
 *     (Lebih aman daripada menebak baris yang salah untuk di-fokus.)
 *
 * Kembalikan id menu target, atau null bila tidak ada / ambigu.
 */
function resolveStockTargetId(targetName: string, allMenus: Menu[]): number | null {
  const needle = targetName.trim().toLowerCase()
  if (!needle) return null
  const matches = allMenus.filter((m) => m.name.trim().toLowerCase() === needle)
  return matches.length === 1 ? matches[0].id : null
}

/**
 * Bangun tautan "lihat stok" untuk sebuah menu. Mengembalikan null bila menu
 * tidak melacak stok (nonStock) — pemanggil cukup tidak merender tombol.
 */
export function resolveMenuStockLink(menu: Menu, allMenus: Menu[]): MenuStockLink | null {
  if (menu.stockType === 'portion') {
    return { to: portionFocusPath(menu.id), label: 'Lihat stok', isFallback: false }
  }

  if (menu.stockType === 'linked' && menu.subOptions && 'stockTarget' in menu.subOptions) {
    const targetName = menu.subOptions.stockTarget
    const targetId = resolveStockTargetId(targetName, allMenus)
    if (targetId != null) {
      return { to: portionFocusPath(targetId), label: `Stok ${targetName}`, isFallback: false }
    }
    // Nama tak terselesaikan → arahkan ke pencarian agar tetap berguna.
    return { to: portionSearchPath(targetName), label: `Cari stok "${targetName}"`, isFallback: true }
  }

  return null
}
