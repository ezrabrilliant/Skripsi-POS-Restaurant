# Skripsi-POS-Restaurant

Sistem Point of Sale (POS) berbasis Web dengan Fitur Rekonsiliasi Kas dan Manajemen Stok Menu Harian  
**Ezra Brilliant Konterliem - C14220315**

## Tentang Aplikasi

Aplikasi Point of Sale (POS) berbasis web untuk restoran keluarga kecil. Dibuat sebagai proyek skripsi dengan fokus pada kesederhanaan dan kegunaan di lingkungan dengan koneksi internet yang tidak stabil.

## Fitur Utama

### Untuk Kasir
- **POS / Kasir** - Halaman utama untuk input pesanan
- **Manajemen Meja** - Melihat status meja (kosong/terisi)
- **Force Order** - Tetap bisa pesan walaupun stok habis (ambil dari cadangan)
- **Riwayat Transaksi** - Melihat transaksi hari ini dan sebelumnya
- **Tutup Kasir (Settlement)** - Rekonsiliasi kas di akhir hari

### Untuk Owner
- Semua fitur kasir +
- **Manajemen Stok** - Atur stok harian menu
- **Manajemen Menu** - CRUD menu restoran
- **Manajemen User** - CRUD kasir dan owner
- **Laporan** - Analisis penjualan dan pendapatan

## Tech Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Auth**: JWT + PIN-based login

### Frontend
- **Framework**: React + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Icons**: Lucide React

## Struktur Folder

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.ts            # Data seeder
│   ├── src/
│   │   ├── index.ts           # Entry point
│   │   ├── lib/
│   │   │   └── prisma.ts      # Prisma client
│   │   ├── middleware/
│   │   │   ├── auth.ts        # JWT authentication
│   │   │   └── errorHandler.ts
│   │   └── routes/
│   │       ├── auth.routes.ts
│   │       ├── user.routes.ts
│   │       ├── menu.routes.ts
│   │       ├── stock.routes.ts
│   │       ├── transaction.routes.ts
│   │       └── settlement.routes.ts
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx            # Router configuration
    │   ├── index.css          # Global styles
    │   ├── components/
    │   │   ├── Layout.tsx
    │   │   ├── MenuGrid.tsx
    │   │   ├── CartPanel.tsx
    │   │   ├── ForceOrderModal.tsx
    │   │   ├── PaymentModal.tsx
    │   │   └── TableSelectModal.tsx
    │   ├── pages/
    │   │   ├── LoginPage.tsx
    │   │   ├── POSPage.tsx
    │   │   ├── TablesPage.tsx
    │   │   ├── HistoryPage.tsx
    │   │   ├── SettlementPage.tsx
    │   │   ├── StockPage.tsx
    │   │   ├── MenuPage.tsx
    │   │   ├── UsersPage.tsx
    │   │   └── ReportsPage.tsx
    │   ├── services/          # API calls
    │   ├── stores/            # Zustand stores
    │   ├── lib/               # Utils & API client
    │   └── types/             # TypeScript types
    ├── package.json
    ├── vite.config.ts
    └── tailwind.config.js
```

## Instalasi

### Prerequisites
- Node.js >= 18
- PostgreSQL >= 14
- npm atau yarn

### 1. Clone Repository
```bash
git clone <repository-url>
cd Skripsi-POS-Restaurant
```

### 2. Setup Backend
```bash
cd backend
npm install

# Setup environment
cp .env.example .env
# Edit .env dengan database URL Anda

# Generate Prisma Client
npx prisma generate

# Migrasi database
npx prisma migrate dev --name init

# Seed data awal (optional)
npx prisma db seed

# Jalankan server
npm run dev
```

### 3. Setup Frontend
```bash
cd frontend
npm install

# Setup environment (sudah ada file .env)
# Sesuaikan VITE_API_URL jika perlu

# Jalankan dev server
npm run dev
```

### 4. Akses Aplikasi
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

### Default Login (setelah seed)
- **Owner**: PIN `123456`
- **Kasir**: PIN `1234`

## Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://user:password@localhost:5432/pos_restaurant"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV=development
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
```

## Database Schema

### Users
- id, name, pin (hashed), role (owner/cashier), isActive

### Menu
- id, name, price, category, description, defaultStock, isActive

### DailyMenuStock
- id, menuId, date, stockStart, stockSold, stockRemaining

### Transaction
- id, tableNumber, status (open/paid/void), items, totals, payment info

### TransactionItem
- id, transactionId, menuId, quantity, price, notes, isForceOrder

### Settlement
- id, date, system totals, actual totals, variance, notes

## API Endpoints

### Auth
- `POST /api/auth/login` - Login dengan PIN

### Users (Owner only)
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Menu
- `GET /api/menu` - List menu
- `GET /api/menu/with-stock` - Menu dengan stok hari ini
- `POST /api/menu` - Create menu (Owner)
- `PUT /api/menu/:id` - Update menu (Owner)
- `DELETE /api/menu/:id` - Delete menu (Owner)

### Stock
- `GET /api/stock/daily` - Get daily stock
- `POST /api/stock/initialize` - Initialize stock for date
- `PUT /api/stock/:id/adjust` - Adjust stock

### Transactions
- `GET /api/transactions` - List transactions
- `GET /api/transactions/table/:tableNumber/open` - Get open bill
- `POST /api/transactions` - Create transaction
- `POST /api/transactions/:id/items` - Add item
- `PUT /api/transactions/:id/pay` - Process payment
- `PUT /api/transactions/:id/void` - Void transaction

### Settlement
- `GET /api/settlements` - List settlements
- `GET /api/settlements/date/:date` - Get by date
- `GET /api/settlements/calculate/:date` - Calculate system totals
- `POST /api/settlements` - Submit settlement

## Build Production

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
# Output di folder dist/
```

## Troubleshooting

### Database Connection Error
Pastikan PostgreSQL berjalan dan DATABASE_URL benar.

### Prisma Generate Error
```bash
npx prisma generate
```

### Port Already in Use
Ubah PORT di .env atau kill process yang menggunakan port tersebut.

## License

MIT License

## Author

Ezra Brilliant Konterliem - Thesis Project 2024
