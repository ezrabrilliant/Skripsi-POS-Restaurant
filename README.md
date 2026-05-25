# Sistem POS Restoran - Ayam Bakar Banjar Monosuko

Sistem Point of Sale (POS) berbasis web untuk restoran. Proyek skripsi Ezra Brilliant Konterliem (C14220315), Sistem Informasi Bisnis UK Petra.

## Tech Stack

- **Backend:** Node.js 20 + Express 4 + TypeScript + Prisma + MySQL
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Auth:** JWT, login PIN 6 digit
- **Peran:** `owner`, `cashier`, `kitchen`

## Prasyarat

- Node.js 20+
- MySQL (mis. via Laragon) - buat database kosong `pos_restaurant`

## Setup

```bash
# 1. Install dependency backend + frontend
npm run install:all

# 2. Siapkan konfigurasi backend
cd backend
cp .env.example .env
# Edit .env - sesuaikan DATABASE_URL dengan MySQL kamu
# Laragon default: mysql://root:@localhost:3306/pos_restaurant

# 3. Migrasi + seed database
npm run prisma:migrate
npm run db:seed
cd ..
```

## Menjalankan

```bash
npm run dev          # backend (:8000) + frontend (:3000) sekaligus
npm run dev:backend  # backend saja
npm run dev:frontend # frontend saja
```

Cek backend hidup: buka `http://localhost:8000/api/health`.

## Akun Default (hasil seed)

| Nama | Peran | PIN |
|------|-------|-----|
| Pak Budi | owner | `100000` |
| Siti | cashier | `200000` |
| Dewi | cashier | `200001` |
| Joko | kitchen | `300000` |

## Fitur

- Autentikasi PIN + tiga peran (owner / kasir / kitchen)
- Manajemen menu (katalog + kategori)
- Stok harian - input pagi oleh kitchen + status opname
- Buka kasir (shift), manajemen meja & pesanan
- **Force order** - pesan meski stok kurang, dengan konfirmasi
- Pembayaran 6 metode + cetak struk + pembatalan (void) ber-PIN owner
- **Tutup kasir blind count** - rekonsiliasi kas + deteksi selisih
- Pencatatan pengeluaran harian
- Dashboard & laporan (pendapatan, pengeluaran, laba kotor)

## Struktur Proyek

```
backend/    API Express + Prisma (lihat backend/README.md untuk daftar API)
frontend/   Aplikasi React (PWA)
docs/       Dokumentasi skripsi - diagram, knowledge base, Bab 3
ROADMAP.md  Status & rencana pengembangan proyek
```

## Dokumentasi

- **API backend** - [backend/README.md](backend/README.md) + `backend/postman_collection.json`
- **Status proyek** - [ROADMAP.md](ROADMAP.md)
- **Diagram & knowledge skripsi** - [docs/knowledge/](docs/knowledge/)
- **Panduan Claude Code** - [CLAUDE.md](CLAUDE.md)

## Catatan

- Backend port 8000, frontend port 3000
- Login PIN 6 digit; PIN disimpan plaintext (trade-off didokumentasikan di skripsi)

## Penyusun

Ezra Brilliant Konterliem - C14220315
