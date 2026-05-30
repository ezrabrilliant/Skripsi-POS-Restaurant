// Sumber kebenaran tunggal katalog menu Resto Ayam Bakar Banjar Monosuko.
// Sinkron dengan `docs/menu-ayam-bakar-banjar-monosuko.md` (canonical reference).
// Dipakai oleh seed.ts (fresh DB) dan scripts/update-menu.ts (sync ke DB existing).
//
// 3 kategori stockType:
//   - 'portion'  : menu adalah stok porsi sendiri (auto-decrement saat order, 1:1 dengan PortionStock).
//   - 'nonStock' : tampil di POS tapi tidak memengaruhi stok apapun.
//   - 'linked'   : menu adalah varian dari menu lain yang punya stok porsi (mis. 1 Ekor Bakar Merah/Kecap berbagi stok).
//
// subOptions JSON (REV 2.6):
//   - null                                                          => menu sederhana
//   - { stockTarget: "Nama Menu" }                                  => stockType='linked', decrement menu target
//   - { fixedItems: [...], choices: [...], description? }           => stockType='nonStock' tipe paket
//
// Format paket subOptions:
//   {
//     fixedItems: ["Nasi Putih", "Sayur Asem"],   // menu yang selalu masuk; portion/linked di-decrement otomatis
//     choices: [
//       {
//         key: "ayam",                            // unik di antara choices, dipakai sebagai key subOptionsSelected
//         label: "Pilih Ayam",                    // ditampilkan ke customer
//         options: [
//           { label: "Paha Bakar", stockTarget: "Paha Ayam Bakar" },  // stockTarget=null kalau info-only
//           { label: "Dada Bakar", stockTarget: "Dada Ayam Bakar" },
//         ],
//       },
//     ],
//   }

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

// ----- Konstanta foto (slug match dengan output `npm run menu:optimize-images`).
// Source: docs/gambar makanan/*.{png,jpg,jpeg,webp}; output: frontend/public/menu/*.webp.
// Sharing diperbolehkan untuk variant visual mirip (linked stock atau pasangan ayam/daging) -
// lihat komentar inline per menu.

// --- Ayam (1 ekor + bagian) ---
const AYAM_BAKAR_1_EKOR_IMG = '/menu/ayam-bakar-1-ekor.webp';
const AYAM_GORENG_1_EKOR_IMG = '/menu/ayam-goreng-1-ekor.webp';
const PAHA_BAKAR_IMG = '/menu/paha-bakar.webp';
const PAHA_GORENG_IMG = '/menu/paha-goreng.webp';
const DADA_BAKAR_IMG = '/menu/dada-bakar.webp';
const DADA_GORENG_IMG = '/menu/dada-goreng.webp';
const KEPALA_AYAM_IMG = '/menu/kepala-ayam.webp';
const AYAM_TAUCO_IMG = '/menu/ayam-kuah-tauco.webp';

// --- Seafood ---
const UDANG_BAKAR_IMG = '/menu/udang-bakar.webp';
const UDANG_GORENG_IMG = '/menu/udang-windu-goreng.webp'; // dipakai juga oleh Udang Promo isi 5
const GURAME_BAKAR_IMG = '/menu/gurami-bakar.webp';
const GURAME_GORENG_IMG = '/menu/gurami-goreng.webp';
const JEROAN_IMG = '/menu/ati-bakar.webp'; // share Ati Ayam & Rempelo Ayam (tusukan jeroan, visual mirip)

// --- Sayur & sup ---
const CAH_KANGKUNG_IMG = '/menu/cah-kangkung.webp';
const SAYUR_ASEM_IMG = '/menu/sayur-asem.webp';
const GARANG_ASEM_IMG = '/menu/garang-asem.webp'; // share Garang Asem Ayam & Daging
const RAWON_IMG = '/menu/rawon.webp';
const SEMUR_DAGING_IMG = '/menu/semur-daging.webp';
const GULAI_IMG = '/menu/gulai.webp'; // share Gulai Daging & Babat

// --- Side dish ---
const EMPAL_PENYET_IMG = '/menu/empal-penyet.webp';
const BAKWAN_PENYET_IMG = '/menu/bakwan-penyet.webp';
const PETAI_IMG = '/menu/petai.webp';
const TAHU_TEMPE_IMG = '/menu/tahu-tempe.webp'; // share semua varian Tahu/Tempe (4 menu)
const TELUR_IMG = '/menu/telur.webp'; // share Telur Mata Sapi & Dadar
const NASI_IMG = '/menu/nasi.webp'; // share Nasi Putih & Goreng
const SAMBAL_IMG = '/menu/sambal.webp'; // share Sambal Terasi & Tomat

// --- Minuman ---
const SARANG_BURUNG_IMG = '/menu/sarang-burung-walet.webp';
const AIR_MINERAL_IMG = '/menu/air-mineral.webp';
const ES_TEH_IMG = '/menu/es-teh.webp'; // share 4 varian Teh (Tawar/Manis × Biasa/Jumbo)
const ES_SIRUP_IMG = '/menu/es-sirup.webp';
const JERUK_NIPIS_IMG = '/menu/es-jeruk-nipis.webp';
const JERUK_PERAS_IMG = '/menu/es-jeruk-peras.webp';
const JERUK_MURNI_IMG = '/menu/es-jeruk-murni.webp';
const ES_DEGAN_IMG = '/menu/es-degan.webp';
const KOPI_IMG = '/menu/kopi.webp';
const SUSU_KEDELAI_IMG = '/menu/susu-kedelai.webp';
const ES_CINCAU_IMG = '/menu/es-cincau.webp';

// --- Paket Hemat ---
const PAKET_KELUARGA_IMG = '/menu/paket-keluarga.webp';
const PAKET_A_IMG = '/menu/paket-a.webp';
const PAKET_B_IMG = '/menu/paket-b.webp';
const PAKET_C_IMG = '/menu/paket-c.webp';
const PAKET_D_IMG = '/menu/paket-d.webp';

export const MENU_CATALOG: MenuCatalogItem[] = [
  // ============================================================
  // KATEGORI: Signature Ayam Bakar (8 item, canonical doc baris 11-20)
  // ============================================================
  // "1 Ekor Ayam Bakar (Merah)" jadi stok master; "Kecap" linked (berbagi stok + foto).
  {
    name: '1 Ekor Ayam Bakar Merah',
    category: 'Signature Ayam Bakar',
    price: 120000,
    stockType: 'portion',
    minStock: 2,
    imageUrl: AYAM_BAKAR_1_EKOR_IMG,
  },
  {
    name: '1 Ekor Ayam Bakar Kecap',
    category: 'Signature Ayam Bakar',
    price: 120000,
    stockType: 'linked',
    imageUrl: AYAM_BAKAR_1_EKOR_IMG,
    subOptions: { stockTarget: '1 Ekor Ayam Bakar Merah' },
  },
  {
    name: '1 Ekor Ayam Goreng',
    category: 'Signature Ayam Bakar',
    price: 120000,
    stockType: 'portion',
    minStock: 2,
    imageUrl: AYAM_GORENG_1_EKOR_IMG,
  },
  {
    name: 'Paha Ayam Bakar',
    category: 'Signature Ayam Bakar',
    price: 30000,
    stockType: 'portion',
    minStock: 10,
    imageUrl: PAHA_BAKAR_IMG,
  },
  {
    name: 'Paha Ayam Goreng',
    category: 'Signature Ayam Bakar',
    price: 30000,
    stockType: 'portion',
    minStock: 10,
    imageUrl: PAHA_GORENG_IMG,
  },
  {
    name: 'Dada Ayam Bakar',
    category: 'Signature Ayam Bakar',
    price: 30000,
    stockType: 'portion',
    minStock: 10,
    imageUrl: DADA_BAKAR_IMG,
  },
  {
    name: 'Dada Ayam Goreng',
    category: 'Signature Ayam Bakar',
    price: 30000,
    stockType: 'portion',
    minStock: 10,
    imageUrl: DADA_GORENG_IMG,
  },
  {
    name: 'Kepala Ayam',
    category: 'Signature Ayam Bakar',
    price: 2500,
    stockType: 'portion',
    minStock: 10,
    imageUrl: KEPALA_AYAM_IMG,
  },

  // ============================================================
  // KATEGORI: Seafood (5 item)
  // ============================================================
  {
    name: 'Udang Windu Bakar (isi 7)',
    category: 'Seafood',
    price: 150000,
    stockType: 'portion',
    minStock: 2,
    imageUrl: UDANG_BAKAR_IMG,
  },
  {
    name: 'Udang Windu Goreng (isi 7)',
    category: 'Seafood',
    price: 150000,
    stockType: 'portion',
    minStock: 2,
    imageUrl: UDANG_GORENG_IMG,
  },
  {
    name: 'Udang Promo (isi 5)',
    category: 'Seafood',
    price: 30000,
    stockType: 'portion',
    minStock: 3,
    imageUrl: UDANG_GORENG_IMG,
  },
  {
    name: 'Gurame Bakar',
    category: 'Seafood',
    price: 100000,
    stockType: 'portion',
    minStock: 2,
    imageUrl: GURAME_BAKAR_IMG,
  },
  {
    name: 'Gurame Goreng',
    category: 'Seafood',
    price: 100000,
    stockType: 'portion',
    minStock: 2,
    imageUrl: GURAME_GORENG_IMG,
  },

  // ============================================================
  // KATEGORI: Jeroan (2 item, per tusuk - 1 tusuk = 1 porsi)
  // ============================================================
  // Tidak ada split Bakar/Goreng - keputusan masak inline di dapur.
  { name: 'Ati Ayam', category: 'Jeroan', price: 5000, stockType: 'portion', minStock: 10, imageUrl: JEROAN_IMG },
  { name: 'Rempelo Ayam', category: 'Jeroan', price: 5000, stockType: 'portion', minStock: 10, imageUrl: JEROAN_IMG },

  // ============================================================
  // KATEGORI: Sayur & Sup (9 item, canonical doc baris 33-44)
  // ============================================================
  { name: 'Cah Kangkung', category: 'Sayur & Sup', price: 20000, stockType: 'nonStock', imageUrl: CAH_KANGKUNG_IMG },
  { name: 'Sayur Asem', category: 'Sayur & Sup', price: 15000, stockType: 'nonStock', imageUrl: SAYUR_ASEM_IMG },
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
    imageUrl: SEMUR_DAGING_IMG,
  },
  // REV 2.8: Semur Ayam - item stok-only dari buku (dicatat opname harian, jarang dijual).
  { name: 'Semur Ayam', category: 'Sayur & Sup', price: 30000, stockType: 'portion', minStock: 5, imageUrl: SEMUR_DAGING_IMG },
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
  // KATEGORI: Side Dish (13 item, canonical doc baris 46-61)
  // ============================================================
  // Empal Penyet & Bakwan Penyet = portion sendiri (canonical doc tidak mencantum
  // varian raw "Empal" / "Bakwan" tanpa penyet).
  {
    name: 'Empal Penyet',
    category: 'Side Dish',
    price: 25000,
    stockType: 'portion',
    minStock: 10,
    imageUrl: EMPAL_PENYET_IMG,
  },
  {
    name: 'Bakwan Penyet',
    category: 'Side Dish',
    price: 30000,
    stockType: 'portion',
    minStock: 10,
    imageUrl: BAKWAN_PENYET_IMG,
  },
  { name: 'Petai Goreng', category: 'Side Dish', price: 20000, stockType: 'portion', minStock: 5, imageUrl: PETAI_IMG },
  { name: 'Tahu Tempe Penyet', category: 'Side Dish', price: 20000, stockType: 'nonStock', imageUrl: TAHU_TEMPE_IMG },
  { name: 'Tahu Tempe Goreng', category: 'Side Dish', price: 12000, stockType: 'nonStock', imageUrl: TAHU_TEMPE_IMG },
  { name: 'Tahu Goreng', category: 'Side Dish', price: 10000, stockType: 'nonStock', imageUrl: TAHU_TEMPE_IMG },
  { name: 'Tempe Goreng', category: 'Side Dish', price: 10000, stockType: 'nonStock', imageUrl: TAHU_TEMPE_IMG },
  { name: 'Telur Mata Sapi', category: 'Side Dish', price: 10000, stockType: 'nonStock', imageUrl: TELUR_IMG },
  { name: 'Telur Dadar', category: 'Side Dish', price: 10000, stockType: 'nonStock', imageUrl: TELUR_IMG },
  { name: 'Nasi Putih', category: 'Side Dish', price: 10000, stockType: 'nonStock', imageUrl: NASI_IMG },
  { name: 'Nasi Goreng', category: 'Side Dish', price: 15000, stockType: 'nonStock', imageUrl: NASI_IMG },
  { name: 'Sambal Terasi', category: 'Side Dish', price: 5000, stockType: 'nonStock', imageUrl: SAMBAL_IMG },
  { name: 'Sambal Tomat', category: 'Side Dish', price: 5000, stockType: 'nonStock', imageUrl: SAMBAL_IMG },
  // REV 2.6: 2 varian kerupuk dari data buku historis (Krupuk B 7k + Krupuk C/Udang 15k).
  // REV 2.8: portion (ditrack opname harian di buku - Krupuk B→Kerupuk, Krupuk C→Kerupuk Udang).
  { name: 'Kerupuk', category: 'Side Dish', price: 7000, stockType: 'portion', minStock: 5, imageUrl: SAMBAL_IMG },
  { name: 'Kerupuk Udang', category: 'Side Dish', price: 15000, stockType: 'portion', minStock: 5, imageUrl: SAMBAL_IMG },

  // ============================================================
  // KATEGORI: Minuman (14 item - sesuai catalog versi user edit)
  // ============================================================
  { name: 'Sarang Burung', category: 'Minuman', price: 80000, stockType: 'portion', minStock: 5, imageUrl: SARANG_BURUNG_IMG },
  { name: 'Air Mineral', category: 'Minuman', price: 5000, stockType: 'nonStock', imageUrl: AIR_MINERAL_IMG },
  { name: 'Teh Tawar Biasa', category: 'Minuman', price: 8000, stockType: 'nonStock', imageUrl: ES_TEH_IMG },
  { name: 'Teh Tawar Jumbo', category: 'Minuman', price: 12000, stockType: 'nonStock', imageUrl: ES_TEH_IMG },
  { name: 'Teh Manis Biasa', category: 'Minuman', price: 10000, stockType: 'nonStock', imageUrl: ES_TEH_IMG },
  { name: 'Teh Manis Jumbo', category: 'Minuman', price: 15000, stockType: 'nonStock', imageUrl: ES_TEH_IMG },
  { name: 'Es Sirup', category: 'Minuman', price: 10000, stockType: 'nonStock', imageUrl: ES_SIRUP_IMG },
  { name: 'Jeruk Nipis', category: 'Minuman', price: 10000, stockType: 'nonStock', imageUrl: JERUK_NIPIS_IMG },
  { name: 'Es Degan', category: 'Minuman', price: 15000, stockType: 'nonStock', imageUrl: ES_DEGAN_IMG },
  { name: 'Jeruk Peras', category: 'Minuman', price: 15000, stockType: 'nonStock', imageUrl: JERUK_PERAS_IMG },
  { name: 'Jeruk Murni', category: 'Minuman', price: 25000, stockType: 'nonStock', imageUrl: JERUK_MURNI_IMG },
  { name: 'Kopi', category: 'Minuman', price: 15000, stockType: 'nonStock', imageUrl: KOPI_IMG },
  { name: 'Susu Kedelai', category: 'Minuman', price: 15000, stockType: 'portion', minStock: 5, imageUrl: SUSU_KEDELAI_IMG },
  { name: 'Es Cincau', category: 'Minuman', price: 12000, stockType: 'nonStock', imageUrl: ES_CINCAU_IMG },

  // ============================================================
  // KATEGORI: Paket Hemat (5 item, canonical doc baris 81-88)
  // ============================================================
  // REV 2.6 schema: paket = fixedItems (selalu masuk) + choices (slot pilihan customer).
  // - fixedItems[]: nama menu yang otomatis decrement stock kalau portion/linked;
  //   nonStock (mis. Nasi Putih, Sayur Asem) cuma jadi catatan ke dapur.
  // - choices[]: tiap slot punya N opsi, tiap opsi punya stockTarget (nullable
  //   kalau slot cuma informational seperti pilihan minuman).
  {
    name: 'Paket Keluarga (3-4 org)',
    category: 'Paket Hemat',
    price: 150000,
    stockType: 'nonStock',
    imageUrl: PAKET_KELUARGA_IMG,
    subOptions: {
      description: '1 Ekor Ayam + 4 Nasi Putih + 4 Teh Tawar',
      fixedItems: ['Nasi Putih', 'Teh Tawar Biasa'],
      choices: [
        {
          key: 'ayam',
          label: 'Pilih Ayam',
          options: [
            { label: 'Bakar', stockTarget: '1 Ekor Ayam Bakar Merah' },
            { label: 'Goreng', stockTarget: '1 Ekor Ayam Goreng' },
          ],
        },
      ],
    },
  },
  {
    name: 'Paket A (1 org)',
    category: 'Paket Hemat',
    price: 50000,
    stockType: 'nonStock',
    imageUrl: PAKET_A_IMG,
    subOptions: {
      description: 'Paha/Dada Ayam + Nasi + Tahu Tempe + Sayur Asem + Minuman',
      fixedItems: ['Nasi Putih', 'Tahu Tempe Goreng', 'Sayur Asem'],
      choices: [
        {
          key: 'ayam',
          label: 'Pilih Ayam',
          options: [
            { label: 'Paha Bakar', stockTarget: 'Paha Ayam Bakar' },
            { label: 'Paha Goreng', stockTarget: 'Paha Ayam Goreng' },
            { label: 'Dada Bakar', stockTarget: 'Dada Ayam Bakar' },
            { label: 'Dada Goreng', stockTarget: 'Dada Ayam Goreng' },
          ],
        },
        {
          key: 'minuman',
          label: 'Pilih Minuman',
          options: [
            { label: 'Teh Tawar', stockTarget: null },
            { label: 'Teh Manis', stockTarget: null },
          ],
        },
      ],
    },
  },
  {
    name: 'Paket B (1 org)',
    category: 'Paket Hemat',
    price: 40000,
    stockType: 'nonStock',
    imageUrl: PAKET_B_IMG,
    subOptions: {
      description: 'Paha/Dada Ayam + Nasi + Tahu Tempe',
      fixedItems: ['Nasi Putih', 'Tahu Tempe Goreng'],
      choices: [
        {
          key: 'ayam',
          label: 'Pilih Ayam',
          options: [
            { label: 'Paha Bakar', stockTarget: 'Paha Ayam Bakar' },
            { label: 'Paha Goreng', stockTarget: 'Paha Ayam Goreng' },
            { label: 'Dada Bakar', stockTarget: 'Dada Ayam Bakar' },
            { label: 'Dada Goreng', stockTarget: 'Dada Ayam Goreng' },
          ],
        },
      ],
    },
  },
  {
    name: 'Paket C (1 org)',
    category: 'Paket Hemat',
    price: 40000,
    stockType: 'nonStock',
    imageUrl: PAKET_C_IMG,
    subOptions: {
      description: '1 Kuah + Nasi Putih + Minuman',
      fixedItems: ['Nasi Putih'],
      choices: [
        {
          key: 'kuah',
          label: 'Pilih Kuah',
          // Catatan: Garang Asem default ke Ayam (lebih umum). Gulai default Daging.
          options: [
            { label: 'Rawon', stockTarget: 'Rawon Daging' },
            { label: 'Gulai', stockTarget: 'Gulai Daging' },
            { label: 'Garang Asem', stockTarget: 'Garang Asem Ayam' },
            { label: 'Bakwan Penyet', stockTarget: 'Bakwan Penyet' },
            { label: 'Semur', stockTarget: 'Semur Daging' },
          ],
        },
        {
          key: 'minuman',
          label: 'Pilih Minuman',
          options: [
            { label: 'Teh Tawar', stockTarget: null },
            { label: 'Teh Manis', stockTarget: null },
            { label: 'Air Mineral', stockTarget: null },
          ],
        },
      ],
    },
  },
  {
    name: 'Paket D (1 org)',
    category: 'Paket Hemat',
    price: 40000,
    stockType: 'nonStock',
    imageUrl: PAKET_D_IMG,
    subOptions: {
      description: 'Empal Penyet + Nasi + Minuman',
      fixedItems: ['Nasi Putih', 'Empal Penyet'],
      choices: [
        {
          key: 'minuman',
          label: 'Pilih Minuman',
          options: [
            { label: 'Teh Tawar', stockTarget: null },
            { label: 'Teh Manis', stockTarget: null },
            { label: 'Air Mineral', stockTarget: null },
          ],
        },
      ],
    },
  },
];
