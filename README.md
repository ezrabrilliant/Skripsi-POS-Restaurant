# POS Restaurant

Sistem Point of Sale untuk restoran.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Laravel 12, MySQL

## Setup

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
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

## Author

Ezra Brilliant Konterliem - C14220315
