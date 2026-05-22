# ROADMAP — Sistem POS Ayam Bakar Banjar Monosuko

Status pengembangan proyek skripsi. Diperbarui terakhir: sesi pembangunan backend Express.

## Ringkasan Status

| Bagian | Status |
|---|---|
| Diagram skripsi (Bab 3) | ✅ Selesai — di `Skripsi.mdj` |
| Naskah Bab 3 | 🔄 Draft siap di `docs/knowledge/BAB-3-DRAFT.md`, tinggal disalin ke buku |
| Backend (Express + Prisma + MySQL) | ✅ Selesai — semua modul, teruji |
| Frontend (React) | ⏸ Belum disesuaikan ke API baru |
| PWA | ✅ Setup selesai (vite-plugin-pwa) — tinggal uji install di HP |

---

## Keputusan Desain (sesi ini)

Perubahan yang memengaruhi naskah skripsi & diagram:

1. **Stack backend: Laravel → Express + TypeScript + Prisma.** Naskah Bab 1.4 & 2.4 perlu menyebut Express/Node, bukan PHP/Laravel.
2. **Database: PostgreSQL → MySQL.** Sudah disesuaikan di semua dokumen `docs/`.
3. **Primary key: UUID → integer auto-increment.** Sudah disesuaikan di ERD doc + data dictionary.
4. **Stok opname hanya pagi** (oleh Kitchen). Stok opname sore (oleh Kasir) **dihapus** dari desain — lihat catatan ripple-effect di bawah.
5. **Server di-host di VPS cloud** (Tencent), karena resto tidak punya WiFi internal — tiap perangkat pakai paket data.

---

## Backend — Selesai ✅

Branch: `feat/backend-express`. Dibangun per fase, tiap fase teruji end-to-end.

| Modul | Endpoint inti |
|---|---|
| Auth | login PIN → JWT, me, verify-pin, logout |
| Menu | list, kategori, detail, CRUD (owner) |
| Stok harian | list, status opname, input pagi (kitchen), reset, copy-yesterday |
| Shift | buka kasir, shift aktif |
| Meja & Transaksi | meja+status, buka transaksi, item add/sync/update/remove, force-order, bayar, void, history, summary |
| Settlement | preview blind, submit blind count, review (owner) |
| Users | CRUD pengguna (owner) |
| Pengeluaran | CRUD (owner) |
| Dashboard | ringkasan harian & bulanan, laba kotor |

8 entitas database sesuai ERD. Detail API: [backend/README.md](backend/README.md).

---

## Yang Belum Dikerjakan ⏸

### 1. Integrasi Frontend
Frontend React masih ditulis untuk API Laravel lama:
- Auth header Sanctum (perlu jadi JWT — sebenarnya sama-sama Bearer, perlu verifikasi)
- Peran `kasir` (perlu `cashier`), belum ada peran `kitchen`
- Belum ada alur **buka kasir / shift** — padahal transaksi sekarang wajib punya shift terbuka
- Service Axios per resource perlu dicek terhadap endpoint Express baru

### 2. PWA — ✅ setup selesai
`vite-plugin-pwa` terpasang: service worker autoUpdate, web manifest, ikon 192/512/maskable, PWA Level A (precache app shell; data API tetap ke jaringan). Sisa: uji "Add to Home Screen" di HP setelah frontend berfungsi.

### 3. Sinkronisasi diagram StarUML (ripple-effect)
Keputusan "stok opname hanya pagi" belum tercermin di `Skripsi.mdj`:
- Activity Diagram **Stock Opname Sore** masih ada → perlu dihapus
- Use Case **Melakukan Stock Opname** (oleh Kasir) masih ada → perlu dihapus
- Setelah itu: re-render PNG, update `docs/knowledge/ACTIVITY.md` & `USE-CASE.md` & `FULL.md`

`docs/knowledge/BAB-3-DRAFT.md` **sudah** mencerminkan keputusan ini (6 activity diagram, 14 use case).

---

## Referensi

| Dokumen | Isi |
|---|---|
| [backend/README.md](backend/README.md) | Cara jalanin backend + daftar API |
| [docs/knowledge/BAB-3-DRAFT.md](docs/knowledge/BAB-3-DRAFT.md) | Draft naskah Bab 3 paste-ready |
| [docs/knowledge/FULL.md](docs/knowledge/FULL.md) | Kompilasi knowledge semua diagram |
| [docs/DATA-DICTIONARY.md](docs/DATA-DICTIONARY.md) | Definisi 8 tabel database |
| [CLAUDE.md](CLAUDE.md) | Panduan arsitektur untuk Claude Code |
