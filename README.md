# POS Restaurant

Sistem Point of Sale untuk restoran.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Laravel 12, MySQL

## Setup

### Prerequisites

- PHP 8.2+
- Composer
- Node.js 18+
- MySQL

### Database

Buat database MySQL:
```sql
CREATE DATABASE pos_restaurant;
```

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Edit file `.env`, sesuaikan konfigurasi database:
```
DB_DATABASE=pos_restaurant
DB_USERNAME=root
DB_PASSWORD=
```

Lalu jalankan migrasi dan seeder:
```bash
php artisan migrate --seed
php artisan serve --port=8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Default Users

| Nama | Role | PIN |
|------|------|-----|
| Pak Budi | Owner | 123456 |
| Siti | Kasir | 111111 |
| Dewi | Kasir | 222222 |

## Environment

Backend `.env`:
```
DB_DATABASE=pos_restaurant
DB_USERNAME=root
DB_PASSWORD=
```

Frontend `.env`:
```
VITE_API_URL=http://localhost:8000/api
```

## Fitur

- Manajemen meja & pesanan
- Stok menu harian
- Force order (pesan meski stok habis)
- Rekonsiliasi kas (settlement)
- Riwayat transaksi
- Laporan penjualan

## Catatan

- Backend jalan di port 8000
- Frontend jalan di port 3000
- Login menggunakan PIN (6 digit)

## Author

Ezra Brilliant Konterliem - C14220315
