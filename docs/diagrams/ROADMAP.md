# Skripsi Diagrams — Progress Tracker

Semua diagram UML untuk Bab 3 skripsi POS Restoran. **Status: selesai.**
Tersimpan dalam satu file StarUML: `Skripsi.mdj` (di root proyek). PNG render ada di folder ini ([INDEX.md](INDEX.md)).

> Untuk status proyek menyeluruh (backend, frontend, dll) lihat [ROADMAP.md](../../ROADMAP.md) di root.

## Progress

| Step | Diagram | Status |
|---|---|---|
| S.1 | Blok Diagram Sistem | ✅ done |
| S.2 | Use Case Diagram | ✅ done |
| S.3 | ERD | ✅ done |
| S.4 | Activity Diagram — Order Flow | ✅ done |
| — | Activity Diagram — Login, Pay, Stock Opname Pagi, Tutup Kasir, Pengeluaran | ✅ done |
| S.6 | Sequence Diagram — Login | ✅ done |
| S.7 | Sequence Diagram — Pay Transaction | ✅ done |
| — | Sequence Diagram — Input Stok, Pengeluaran, Tutup Kasir | ✅ done |
| S.8 | Flowchart — Force Order Logic | ✅ done |

## Catatan revisi tertunda

Keputusan desain final: **stok opname hanya pagi** (oleh Kitchen). Diagram berikut di `Skripsi.mdj` masih perlu dihapus agar konsisten dengan `docs/knowledge/BAB-3-DRAFT.md`:

- Activity Diagram **Stock Opname Sore** (oleh Kasir)
- Use Case **Melakukan Stock Opname** (oleh Kasir)

Setelah dihapus: re-render PNG + update ACTIVITY.md, USE-CASE.md, FULL.md.
