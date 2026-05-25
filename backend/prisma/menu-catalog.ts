// Sumber kebenaran tunggal katalog menu Resto Ayam Bakar Banjar Monosuko (REV 2).
// Dipakai oleh seed.ts (fresh DB).
//
// 3 kategori stockType:
//   - 'portion'  : menu adalah stok porsi sendiri (auto-decrement saat order, 1:1 dengan PortionStock).
//   - 'nonStock' : tampil di POS tapi tidak memengaruhi stok apapun.
//   - 'linked'   : menu adalah varian dari menu lain yang punya stok porsi (mis. 1 Ekor Bakar Merah/Kecap berbagi stok).
//
// subOptions JSON:
//   - null                                           => menu sederhana
//   - { stockTarget: "Nama Menu" }                   => stockType='linked', decrement menu target
//   - { options: [...], stockMap: { key: target } }  => stockType='nonStock' tipe paket dengan pilihan customer
//
// Format options untuk paket:
//   [{ key: "ayamPart", label: "Pilih Bagian Ayam", options: ["Paha", "Dada"] }, ...]
//
// Format stockMap: key = nilai join sub-options dengan separator "|", value = nama menu stok porsi target.

import type { Prisma } from '@prisma/client';

export interface MenuCatalogItem {
  name: string;
  category: string;
  price: number;
  stockType: 'portion' | 'linked' | 'nonStock';
  minStock?: number; // hanya untuk stockType='portion'
  imageUrl?: string;
  subOptions?: Prisma.InputJsonValue;
}

// ----- Konstanta foto (re-use yang sudah ada di frontend/public/menu/) -----
const AYAM_BAKAR_IMG = '/menu/ayam-bakar.webp';
const AYAM_GORENG_IMG = '/menu/ayam-goreng.webp';
const AYAM_TAUCO_IMG = '/menu/ayam-kuah-tauco.webp';
const BAKWAN_IMG = '/menu/bakwan-goreng.webp';
const GARANG_ASEM_IMG = '/menu/garang-asem.webp';
const GULAI_IMG = '/menu/gulai.webp';
const GURAME_IMG = '/menu/gurami-goreng.webp';
const RAWON_IMG = '/menu/rawon.webp';
const UDANG_IMG = '/menu/udang-bakar.webp';

export const MENU_CATALOG: MenuCatalogItem[] = [
  // ============================================================
  // KATEGORI: Signature Ayam Bakar
  // ============================================================
  // "1 Ekor Ayam Bakar (Merah)" jadi stok master; "Kecap" linked (berbagi stok).
  {
    name: '1 Ekor Ayam Bakar Merah',
    category: 'Signature Ayam Bakar',
    price: 120000,
    stockType: 'portion',
    minStock: 2,
    imageUrl: AYAM_BAKAR_IMG,
  },
  {
    name: '1 Ekor Ayam Bakar Kecap',
    category: 'Signature Ayam Bakar',
    price: 120000,
    stockType: 'linked',
    imageUrl: AYAM_BAKAR_IMG,
    subOptions: { stockTarget: '1 Ekor Ayam Bakar Merah' },
  },
  {
    name: '1 Ekor Ayam Goreng',
    category: 'Signature Ayam Bakar',
    price: 120000,
    stockType: 'portion',
    minStock: 2,
    imageUrl: AYAM_GORENG_IMG,
  },
  {
    name: 'Paha Ayam Bakar',
    category: 'Signature Ayam Bakar',
    price: 30000,
    stockType: 'portion',
    minStock: 10,
    imageUrl: AYAM_BAKAR_IMG,
  },
  {
    name: 'Paha Ayam Goreng',
    category: 'Signature Ayam Bakar',
    price: 30000,
    stockType: 'portion',
    minStock: 10,
    imageUrl: AYAM_GORENG_IMG,
  },
  {
    name: 'Dada Ayam Bakar',
    category: 'Signature Ayam Bakar',
    price: 30000,
    stockType: 'portion',
    minStock: 10,
    imageUrl: AYAM_BAKAR_IMG,
  },
  {
    name: 'Dada Ayam Goreng',
    category: 'Signature Ayam Bakar',
    price: 30000,
    stockType: 'portion',
    minStock: 10,
    imageUrl: AYAM_GORENG_IMG,
  },
  {
    name: 'Kepala Ayam',
    category: 'Signature Ayam Bakar',
    price: 2500,
    stockType: 'portion',
    minStock: 10,
    imageUrl: AYAM_BAKAR_IMG,
  },

  // ============================================================
  // KATEGORI: Seafood
  // ============================================================
  {
    name: 'Udang Windu Bakar (isi 7)',
    category: 'Seafood',
    price: 150000,
    stockType: 'portion',
    minStock: 2,
    imageUrl: UDANG_IMG,
  },
  {
    name: 'Udang Windu Goreng (isi 7)',
    category: 'Seafood',
    price: 150000,
    stockType: 'portion',
    minStock: 2,
    imageUrl: UDANG_IMG,
  },
  {
    name: 'Udang Promo (isi 5)',
    category: 'Seafood',
    price: 30000,
    stockType: 'portion',
    minStock: 3,
    imageUrl: UDANG_IMG,
  },
  {
    name: 'Gurame Bakar',
    category: 'Seafood',
    price: 100000,
    stockType: 'portion',
    minStock: 2,
    imageUrl: GURAME_IMG,
  },
  {
    name: 'Gurame Goreng',
    category: 'Seafood',
    price: 100000,
    stockType: 'portion',
    minStock: 2,
    imageUrl: GURAME_IMG,
  },
  // Jeroan — per tusuk, satuan = porsi (1 tusuk = 1 porsi).
  { name: 'Ati Bakar', category: 'Seafood', price: 5000, stockType: 'portion', minStock: 10 },
  { name: 'Ati Goreng', category: 'Seafood', price: 5000, stockType: 'portion', minStock: 10 },
  { name: 'Rampela Bakar', category: 'Seafood', price: 5000, stockType: 'portion', minStock: 10 },
  { name: 'Rampela Goreng', category: 'Seafood', price: 5000, stockType: 'portion', minStock: 10 },

  // ============================================================
  // KATEGORI: Sayur & Sup (mix portion + nonStock)
  // ============================================================
  { name: 'Cah Kangkung', category: 'Sayur & Sup', price: 20000, stockType: 'nonStock' },
  { name: 'Sayur Asem', category: 'Sayur & Sup', price: 15000, stockType: 'nonStock' },
  {
    name: 'Ayam Tauco',
    category: 'Sayur & Sup',
    price: 35000,
    stockType: 'portion',
    minStock: 5,
    imageUrl: AYAM_TAUCO_IMG,
  },
  {
    name: 'Garang Asem Ayam',
    category: 'Sayur & Sup',
    price: 30000,
    stockType: 'portion',
    minStock: 5,
    imageUrl: GARANG_ASEM_IMG,
  },
  {
    name: 'Garang Asem Daging',
    category: 'Sayur & Sup',
    price: 30000,
    stockType: 'portion',
    minStock: 5,
    imageUrl: GARANG_ASEM_IMG,
  },
  {
    name: 'Rawon Daging',
    category: 'Sayur & Sup',
    price: 30000,
    stockType: 'portion',
    minStock: 5,
    imageUrl: RAWON_IMG,
  },
  {
    name: 'Semur Daging',
    category: 'Sayur & Sup',
    price: 30000,
    stockType: 'portion',
    minStock: 5,
  },
  {
    name: 'Gulai Daging',
    category: 'Sayur & Sup',
    price: 30000,
    stockType: 'portion',
    minStock: 5,
    imageUrl: GULAI_IMG,
  },
  {
    name: 'Gulai Babat',
    category: 'Sayur & Sup',
    price: 30000,
    stockType: 'portion',
    minStock: 5,
    imageUrl: GULAI_IMG,
  },

  // ============================================================
  // KATEGORI: Side Dish & Tambahan (mix)
  // ============================================================
  // Empal & Bakwan: penyet adalah varian saji (ada sambal). Stok porsi pakai nama "Empal" / "Bakwan" raw — varian penyet linked.
  { name: 'Empal', category: 'Side Dish', price: 25000, stockType: 'portion', minStock: 10 },
  {
    name: 'Empal Penyet',
    category: 'Side Dish',
    price: 25000,
    stockType: 'linked',
    subOptions: { stockTarget: 'Empal' },
  },
  {
    name: 'Bakwan',
    category: 'Side Dish',
    price: 30000,
    stockType: 'portion',
    minStock: 10,
    imageUrl: BAKWAN_IMG,
  },
  {
    name: 'Bakwan Penyet',
    category: 'Side Dish',
    price: 30000,
    stockType: 'linked',
    imageUrl: BAKWAN_IMG,
    subOptions: { stockTarget: 'Bakwan' },
  },
  { name: 'Petai Goreng', category: 'Side Dish', price: 20000, stockType: 'nonStock' },
  { name: 'Tahu Tempe Penyet', category: 'Side Dish', price: 20000, stockType: 'nonStock' },
  { name: 'Tahu Tempe Goreng', category: 'Side Dish', price: 12000, stockType: 'nonStock' },
  { name: 'Tahu Goreng', category: 'Side Dish', price: 10000, stockType: 'nonStock' },
  { name: 'Tempe Goreng', category: 'Side Dish', price: 10000, stockType: 'nonStock' },
  { name: 'Telur Mata Sapi', category: 'Side Dish', price: 10000, stockType: 'nonStock' },
  { name: 'Telur Dadar', category: 'Side Dish', price: 10000, stockType: 'nonStock' },
  { name: 'Nasi Putih', category: 'Side Dish', price: 10000, stockType: 'nonStock' },
  { name: 'Nasi Goreng', category: 'Side Dish', price: 15000, stockType: 'nonStock' },
  { name: 'Sambal Terasi', category: 'Side Dish', price: 5000, stockType: 'nonStock' },
  { name: 'Sambal Tomat', category: 'Side Dish', price: 5000, stockType: 'nonStock' },

  // ============================================================
  // KATEGORI: Minuman (semua nonStock)
  // ============================================================
  { name: 'Sarang Burung', category: 'Minuman', price: 80000, stockType: 'nonStock' },
  { name: 'Air Mineral', category: 'Minuman', price: 5000, stockType: 'nonStock' },
  { name: 'Teh Tawar Biasa', category: 'Minuman', price: 8000, stockType: 'nonStock' },
  { name: 'Teh Tawar Jumbo', category: 'Minuman', price: 12000, stockType: 'nonStock' },
  { name: 'Teh Manis Biasa', category: 'Minuman', price: 10000, stockType: 'nonStock' },
  { name: 'Teh Manis Jumbo', category: 'Minuman', price: 15000, stockType: 'nonStock' },
  { name: 'Es Sirup', category: 'Minuman', price: 10000, stockType: 'nonStock' },
  { name: 'Jeruk Nipis', category: 'Minuman', price: 10000, stockType: 'nonStock' },
  { name: 'Es Degan', category: 'Minuman', price: 15000, stockType: 'nonStock' },
  { name: 'Jeruk Peras', category: 'Minuman', price: 15000, stockType: 'nonStock' },
  { name: 'Jeruk Murni', category: 'Minuman', price: 25000, stockType: 'nonStock' },
  { name: 'Kopi', category: 'Minuman', price: 15000, stockType: 'nonStock' },
  { name: 'Susu Kedelai', category: 'Minuman', price: 15000, stockType: 'nonStock' },
  { name: 'Cincau', category: 'Minuman', price: 12000, stockType: 'nonStock' },

  // ============================================================
  // KATEGORI: Paket Hemat (5 paket dengan sub-options dinamis)
  // ============================================================
  // Format stockMap key = nilai sub-options dijoin "|" mengikuti urutan options array.
  // Mis. options=[{key:"cook"}], stockMap "Bakar"->"1 Ekor Ayam Bakar Merah".
  // Stok target hanya stok porsi yang relevan; minuman/sayur asem/tahu tempe nonStock tidak perlu di stockMap.
  {
    name: 'Paket Keluarga (3-4 org)',
    category: 'Paket Hemat',
    price: 150000,
    stockType: 'nonStock',
    imageUrl: AYAM_BAKAR_IMG,
    subOptions: {
      description: '1 Ekor Ayam + 4 Nasi Putih + 4 Teh Tawar',
      options: [{ key: 'cook', label: 'Cara Masak', options: ['Bakar', 'Goreng'] }],
      stockMap: {
        Bakar: '1 Ekor Ayam Bakar Merah',
        Goreng: '1 Ekor Ayam Goreng',
      },
    },
  },
  {
    name: 'Paket A (1 org)',
    category: 'Paket Hemat',
    price: 50000,
    stockType: 'nonStock',
    imageUrl: AYAM_BAKAR_IMG,
    subOptions: {
      description: 'Paha/Dada Ayam + Nasi + Tahu Tempe + Sayur Asem + Minuman',
      options: [
        { key: 'ayamPart', label: 'Bagian Ayam', options: ['Paha', 'Dada'] },
        { key: 'cook', label: 'Cara Masak', options: ['Bakar', 'Goreng'] },
        { key: 'minuman', label: 'Minuman', options: ['Teh Tawar', 'Teh Manis'] },
      ],
      stockMap: {
        'Paha|Bakar|Teh Tawar': 'Paha Ayam Bakar',
        'Paha|Bakar|Teh Manis': 'Paha Ayam Bakar',
        'Paha|Goreng|Teh Tawar': 'Paha Ayam Goreng',
        'Paha|Goreng|Teh Manis': 'Paha Ayam Goreng',
        'Dada|Bakar|Teh Tawar': 'Dada Ayam Bakar',
        'Dada|Bakar|Teh Manis': 'Dada Ayam Bakar',
        'Dada|Goreng|Teh Tawar': 'Dada Ayam Goreng',
        'Dada|Goreng|Teh Manis': 'Dada Ayam Goreng',
      },
    },
  },
  {
    name: 'Paket B (1 org)',
    category: 'Paket Hemat',
    price: 40000,
    stockType: 'nonStock',
    imageUrl: AYAM_BAKAR_IMG,
    subOptions: {
      description: 'Paha/Dada Ayam + Nasi + Tahu Tempe',
      options: [
        { key: 'ayamPart', label: 'Bagian Ayam', options: ['Paha', 'Dada'] },
        { key: 'cook', label: 'Cara Masak', options: ['Bakar', 'Goreng'] },
      ],
      stockMap: {
        'Paha|Bakar': 'Paha Ayam Bakar',
        'Paha|Goreng': 'Paha Ayam Goreng',
        'Dada|Bakar': 'Dada Ayam Bakar',
        'Dada|Goreng': 'Dada Ayam Goreng',
      },
    },
  },
  {
    name: 'Paket C (1 org)',
    category: 'Paket Hemat',
    price: 40000,
    stockType: 'nonStock',
    imageUrl: RAWON_IMG,
    subOptions: {
      description: '1 Kuah + Nasi Putih + Minuman',
      options: [
        {
          key: 'kuah',
          label: 'Pilihan Kuah',
          options: ['Rawon', 'Gulai', 'Garang Asem', 'Bakwan', 'Semur'],
        },
        { key: 'minuman', label: 'Minuman', options: ['Teh Tawar', 'Teh Manis', 'Air Mineral'] },
      ],
      // Catatan: Garang Asem default ke Ayam (lebih umum). Gulai default Daging.
      // Kalau resto mau bisa pilih Daging untuk Garang Asem juga, tambah sub-option ke-3.
      stockMap: {
        'Rawon|Teh Tawar': 'Rawon Daging',
        'Rawon|Teh Manis': 'Rawon Daging',
        'Rawon|Air Mineral': 'Rawon Daging',
        'Gulai|Teh Tawar': 'Gulai Daging',
        'Gulai|Teh Manis': 'Gulai Daging',
        'Gulai|Air Mineral': 'Gulai Daging',
        'Garang Asem|Teh Tawar': 'Garang Asem Ayam',
        'Garang Asem|Teh Manis': 'Garang Asem Ayam',
        'Garang Asem|Air Mineral': 'Garang Asem Ayam',
        'Bakwan|Teh Tawar': 'Bakwan',
        'Bakwan|Teh Manis': 'Bakwan',
        'Bakwan|Air Mineral': 'Bakwan',
        'Semur|Teh Tawar': 'Semur Daging',
        'Semur|Teh Manis': 'Semur Daging',
        'Semur|Air Mineral': 'Semur Daging',
      },
    },
  },
  {
    name: 'Paket D (1 org)',
    category: 'Paket Hemat',
    price: 38000,
    stockType: 'nonStock',
    subOptions: {
      description: 'Empal Penyet + Nasi + Minuman',
      options: [
        { key: 'minuman', label: 'Minuman', options: ['Teh Tawar', 'Teh Manis', 'Air Mineral'] },
      ],
      stockMap: {
        'Teh Tawar': 'Empal',
        'Teh Manis': 'Empal',
        'Air Mineral': 'Empal',
      },
    },
  },
];
