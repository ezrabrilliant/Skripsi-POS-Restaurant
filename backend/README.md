# Backend API - POS Restoran Ayam Bakar Banjar Monosuko

Backend Express + TypeScript + Prisma + MySQL. Bagian dari skripsi C14220315.

## Prasyarat

- **Node.js 20+**
- **MySQL** (Laragon) berjalan, dengan database kosong bernama `pos_restaurant`

## Setup Awal (sekali saja)

```bash
cd backend
npm install                 # install dependency
cp .env.example .env        # salin konfigurasi, lalu sesuaikan DATABASE_URL
npm run prisma:migrate      # buat tabel di MySQL
npm run db:seed             # isi data awal (4 user + 47 menu)
```

Pastikan `DATABASE_URL` di `.env` cocok dengan MySQL Laragon kamu. Default Laragon (password root kosong):

```
DATABASE_URL="mysql://root:@localhost:3306/pos_restaurant"
```

## Menjalankan Server

**Penting:** backend baru ada di folder `backend/`, bukan lagi Laravel. Ada dua cara:

```bash
# Cara 1 - dari folder backend
cd backend
npm run dev

# Cara 2 - dari folder root (backend + frontend sekaligus)
npm run dev
```

Server berjalan di **http://localhost:8000**. Cek hidup: buka `http://localhost:8000/api/health`.

## Perintah Lain

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan server mode watch (auto-restart saat file berubah) |
| `npm run build` | Compile TypeScript ke folder `dist/` |
| `npm run start` | Jalankan hasil build (produksi) |
| `npm run prisma:migrate` | Terapkan perubahan skema ke database |
| `npm run prisma:studio` | Buka Prisma Studio (GUI lihat isi database) |
| `npm run db:seed` | Isi data awal |
| `npm run db:fresh` | Reset database + migrasi ulang (hapus semua data) |

## Akun Seed (untuk login)

| Peran | Nama | PIN |
|---|---|---|
| owner | Pak Budi | `100000` |
| cashier | Siti | `200000` |
| cashier | Dewi | `200001` |
| kitchen | Joko | `300000` |

## Daftar API

Base URL: `http://localhost:8000/api` - semua respons berbentuk `{ success, message, data }`.
Akses: **publik** / **login** (token apa pun) / **kasir** / **kitchen** / **owner**.

### Health & Auth
| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/health` | publik | Cek server hidup |
| POST | `/auth/login` | publik | Login PIN → token JWT |
| GET | `/auth/me` | login | Data user yang sedang login |
| POST | `/auth/verify-pin` | login | Verifikasi PIN untuk elevasi otorisasi |
| POST | `/auth/logout` | login | Logout (token dihapus di klien) |

### Menu
| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/menus` | publik | Daftar menu. Query: `category`, `isActive`, `search` |
| GET | `/menus/categories` | publik | Daftar kategori unik |
| GET | `/menus/:id` | publik | Detail menu |
| POST/PUT/DELETE | `/menus` `/menus/:id` | owner | Tambah / ubah / hapus menu |

### Stok Harian
| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/stocks` | login | Daftar stok (query `date`) |
| GET | `/stocks/status` | login | Cek opname pagi sudah/belum |
| POST | `/stocks` `/stocks/bulk` | kitchen/owner | Input stok (satu / banyak menu) |
| PUT | `/stocks/:id` | kitchen/owner | Koreksi stok |
| POST | `/stocks/reset-today` `/stocks/copy-yesterday` | kitchen/owner | Reset / salin stok |

### Shift (Buka Kasir)
| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/shifts/open` | kasir/owner | Buka kasir (input modal awal) |
| GET | `/shifts/current` | kasir/owner | Shift aktif saat ini |

### Meja & Transaksi
| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/tables` | kasir/owner | Daftar meja + status |
| GET | `/tables/:n/transaction` | kasir/owner | Transaksi terbuka pada meja |
| POST | `/tables/:n/transfer` | kasir/owner | Pindah pesanan antar meja |
| POST | `/transactions` | kasir/owner | Buka transaksi meja |
| GET | `/transactions` `/transactions/:id` | kasir/owner | Daftar terbuka / detail |
| GET | `/transactions/history` | kasir/owner | Riwayat (query `date`, `status`) |
| GET | `/transactions/daily-summary` | kasir/owner | Ringkasan penjualan harian |
| POST | `/transactions/:id/items` | kasir/owner | Tambah item (force order via `forceOrder:true`) |
| PUT | `/transactions/:id/items` | kasir/owner | Sinkron seluruh keranjang |
| PUT/DELETE | `/transactions/:id/items/:itemId` | kasir/owner | Ubah / hapus item |
| POST | `/transactions/:id/pay` | kasir/owner | Bayar |
| POST | `/transactions/:id/void` | kasir/owner | Batalkan (butuh `ownerPin`) |

### Settlement (Tutup Kasir)
| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/settlements/preview` | kasir/owner | Pratinjau tutup kasir (blind) |
| POST | `/settlements` | kasir/owner | Submit blind count → tutup shift |
| GET | `/settlements` `/settlements/:id` | kasir/owner | Daftar / detail |
| POST | `/settlements/:id/review` | owner | Review rekonsiliasi |

### Users, Pengeluaran, Dashboard (owner-only)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET/POST/PUT/DELETE | `/users` `/users/:id` | Kelola pengguna |
| GET/POST/PUT/DELETE | `/expenses` `/expenses/:id` | Kelola pengeluaran (query `date`/`month`/`category`) |
| GET | `/dashboard/daily?date=YYYY-MM-DD` | Ringkasan harian |
| GET | `/dashboard/summary?month=YYYY-MM` | Ringkasan bulanan (laba kotor) |

## Postman

Import file **`postman_collection.json`** (di folder ini) ke Postman:
1. Buka Postman → **Import** → pilih `backend/postman_collection.json`
2. Jalankan request **Auth → POST Login** dulu - token JWT otomatis tersimpan ke variabel koleksi
3. Request lain (yang butuh login) otomatis memakai token tersebut

## Cara Pakai (alur tipikal)

1. `POST /auth/login` dengan PIN → dapat `token`
2. Sertakan header `Authorization: Bearer <token>` pada request yang butuh login
3. Endpoint owner-only (tambah/ubah/hapus menu) hanya bisa diakses token milik user `owner`
