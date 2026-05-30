// Transkripsi data buku resto (1-27 Mei 2026) hasil OCR foto buku → struktur.
// STRATEGI (disetujui Ezra): nominal buku = OTORITAS. payment + total transaksi =
// `amount` PERSIS → rekonsiliasi harian per metode dijamin match buku. Item = best-effort
// (dekomposisi realistis untuk demo); kalau Σ(harga item) ≠ amount, yang dipakai amount buku.
//
// Keputusan terkunci:
//   #A online delivery: ikut buku apa adanya (gojek 1 + grab 2).
//   #B non-reconcile: nominal buku otoritas (tidak koreksi per baris).
//   #C Kerupuk 7k + Kerupuk Udang 15k (2 menu baru).
//   #D stok harian: opname per tanggal (file import stok terpisah).
//   #E TF MK → transfer/BCA; Qris BM → qris/Mandiri; qris lain → qris/BCA.
//   #F 17 Mei #6 (dibatalkan) → keep paid (summary match).
//   #G "Inhaler" → skip (OCR error). 21 Mei cash jadi 182k ≠ 217k (di-flag).
//
// Item pakai NAMA KANONIK menu (resolve ke id saat import). Paket: pilihan → notes.
// method: cash|qris|edc|transfer|gojek|grab. bank: hanya utk qris/edc/transfer.
// orderType: dineIn (default, table 1-9) | takeaway (gojek/grab + transfer delivery).

export type BookItem = { name: string; qty: number; notes?: string }
export type BookTx = {
  items: BookItem[]
  amount: number
  method: 'cash' | 'qris' | 'edc' | 'transfer' | 'gojek' | 'grab'
  bank?: string
  orderType: 'dineIn' | 'takeaway'
  table?: number
  raw: string // deskripsi asli buku (audit)
}
export type BookDay = {
  date: string // YYYY-MM-DD (WIB)
  cashier: 'Bryant' | 'Chen Hong'
  openingCash: number
  transactions: BookTx[]
  stock: { name: string; qty: number }[] // hitungan stok porsi harian (halaman kiri)
  summary: Partial<Record<BookTx['method'], number>> // ringkasan buku per metode (utk verifikasi)
}

// Singkatan stok → nama kanonik menu (untuk import stok opname harian).
// Item stok yg TIDAK ada menu porsi (Krupuk/Susuk/Ikan generik) di-skip saat opname.
export const STOCK_ALIAS: Record<string, string> = {
  'PAHA B': 'Paha Ayam Bakar', 'PAHA G': 'Paha Ayam Goreng',
  'DADA B': 'Dada Ayam Bakar', 'DADA G': 'Dada Ayam Goreng',
  'Ati': 'Ati Ayam', 'Rempelo': 'Rempelo Ayam', 'Kepala': 'Kepala Ayam',
  'Gasem A': 'Garang Asem Ayam', 'Gasem D': 'Garang Asem Daging',
  'Rawon': 'Rawon Daging', 'Semur D': 'Semur Daging',
  'Gulai D': 'Gulai Daging', 'Gule D': 'Gulai Daging',
  'Gulai B': 'Gulai Babat', 'Gule B': 'Gulai Babat',
  'Empal': 'Empal Penyet', 'Bakwan': 'Bakwan Penyet', 'Petai': 'Petai Goreng',
  'Udang W': 'Udang Windu Bakar (isi 7)', 'Ikan': 'Gurame Bakar',
  'Sarang B': 'Sarang Burung',
  // Tidak dipetakan (no portion menu): Semur A, PAHA C, Susuk, Krupuk B, Krupuk C
}

export const BOOK_DATA: BookDay[] = [
  // ============ 1 Mei (Jumat) ============
  {
    date: '2026-05-01', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 12 }, { name: 'DADA B', qty: 16 }, { name: 'PAHA G', qty: 4 }, { name: 'DADA G', qty: 6 },
      { name: 'Ati', qty: 9 }, { name: 'Rempelo', qty: 5 }, { name: 'Kepala', qty: 9 }, { name: 'Gasem D', qty: 2 },
      { name: 'Gasem A', qty: 5 }, { name: 'Semur D', qty: 5 }, { name: 'Gulai D', qty: 5 }, { name: 'Gulai B', qty: 2 },
      { name: 'Rawon', qty: 3 }, { name: 'Empal', qty: 12 }, { name: 'Bakwan', qty: 17 }, { name: 'Udang W', qty: 28 },
      { name: 'Ikan', qty: 2 }, { name: 'Sarang B', qty: 20 }, { name: 'Petai', qty: 19 },
    ],
    transactions: [
      { raw: '1 EKOR B, 1 NASI, 1 TEH T J', amount: 142000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 1,
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 1 }, { name: 'Nasi Putih', qty: 1 }, { name: 'Teh Tawar Jumbo', qty: 1 }] },
      { raw: '1 PAKET A (DADA B M, TEH T J)', amount: 50000, method: 'cash', orderType: 'dineIn', table: 2,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Dada Bakar + Teh Tawar Jumbo' }] },
    ],
    summary: { qris: 142000, cash: 50000 },
  },
  // ============ 2 Mei (Sabtu) ============
  {
    date: '2026-05-02', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 13 }, { name: 'DADA B', qty: 15 }, { name: 'DADA G', qty: 3 }, { name: 'Ati', qty: 9 },
      { name: 'Rempelo', qty: 5 }, { name: 'Kepala', qty: 8 }, { name: 'Gasem D', qty: 2 }, { name: 'Gasem A', qty: 5 },
      { name: 'Semur D', qty: 5 }, { name: 'Gulai D', qty: 5 }, { name: 'Gulai B', qty: 2 }, { name: 'Rawon', qty: 3 },
      { name: 'Empal', qty: 12 }, { name: 'Bakwan', qty: 17 }, { name: 'Udang W', qty: 28 }, { name: 'Ikan', qty: 2 },
      { name: 'Sarang B', qty: 20 }, { name: 'Petai', qty: 19 },
    ],
    transactions: [
      { raw: 'Gurame B', amount: 100000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 3,
        items: [{ name: 'Gurame Bakar', qty: 1 }] },
      { raw: 'PAKET A (DADA B, TEH M), PAKET B (Paha)', amount: 105000, method: 'cash', orderType: 'dineIn', table: 4,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Dada Bakar + Teh Manis' }, { name: 'Paket B (1 org)', qty: 1, notes: 'Paha' }, { name: 'Jeruk Peras', qty: 1 }] },
      { raw: 'Krupuk (Jeruk P pindah dari sini ke tx#2)', amount: 7000, method: 'cash', orderType: 'dineIn', table: 5,
        items: [{ name: 'Kerupuk', qty: 1 }] },
      { raw: '1 Empal P, 1 nasi, 1 Jeruk murni, 1 PAKET C (RAWON, TEH M), 1 Krupuk', amount: 115000, method: 'cash', orderType: 'dineIn', table: 6,
        items: [{ name: 'Empal Penyet', qty: 1 }, { name: 'Nasi Putih', qty: 1 }, { name: 'Jeruk Murni', qty: 1 }, { name: 'Paket C (1 org)', qty: 1, notes: 'Rawon + Teh Manis' }, { name: 'Kerupuk', qty: 1 }] },
    ],
    summary: { qris: 100000, cash: 227000 },
  },
  // ============ 3 Mei (Minggu) ============
  {
    date: '2026-05-03', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 11 }, { name: 'DADA B', qty: 13 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 3 },
      { name: 'Ati', qty: 8 }, { name: 'Rempelo', qty: 5 }, { name: 'Kepala', qty: 8 }, { name: 'Gasem D', qty: 2 },
      { name: 'Gasem A', qty: 5 }, { name: 'Semur D', qty: 5 }, { name: 'Gulai D', qty: 5 }, { name: 'Gulai B', qty: 2 },
      { name: 'Rawon', qty: 2 }, { name: 'Empal', qty: 11 }, { name: 'Bakwan', qty: 17 }, { name: 'Udang W', qty: 28 },
      { name: 'Ikan', qty: 1 }, { name: 'Sarang B', qty: 20 }, { name: 'Petai', qty: 19 },
    ],
    transactions: [
      { raw: 'Paket Keluarga (1 ekor B, 4 AM), 1 Sayur Asem, 1 Krupuk', amount: 185000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 7,
        items: [{ name: 'Paket Keluarga (3-4 org)', qty: 1, notes: '1 Ekor Bakar + 4 Air Mineral' }, { name: 'Sayur Asem', qty: 1 }, { name: 'Kerupuk', qty: 1 }] },
      { raw: 'Paket A (Paha B, AM), Empal P, 1 Paha B, 1 Nasi', amount: 115000, method: 'edc', bank: 'BCA', orderType: 'dineIn', table: 8,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Paha Bakar + Air Mineral' }, { name: 'Empal Penyet', qty: 1 }, { name: 'Paha Ayam Bakar', qty: 1 }, { name: 'Nasi Putih', qty: 1 }] },
    ],
    summary: { qris: 185000, edc: 115000 },
  },
  // ============ 4 Mei (Senin) ============
  {
    date: '2026-05-04', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 20 }, { name: 'DADA B', qty: 21 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 3 },
      { name: 'Ati', qty: 9 }, { name: 'Rempelo', qty: 5 }, { name: 'Kepala', qty: 8 }, { name: 'Gasem D', qty: 2 },
      { name: 'Gasem A', qty: 5 }, { name: 'Semur D', qty: 5 }, { name: 'Gulai D', qty: 5 }, { name: 'Gulai B', qty: 2 },
      { name: 'Rawon', qty: 2 }, { name: 'Empal', qty: 10 }, { name: 'Bakwan', qty: 17 }, { name: 'Udang W', qty: 28 },
      { name: 'Ikan', qty: 1 }, { name: 'Sarang B', qty: 20 }, { name: 'Petai', qty: 19 },
    ],
    transactions: [
      { raw: '4 Ekor (BM/B), 14 Nasi, Susuk K', amount: 455000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 9,
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 4, notes: 'borongan @100rb (diskon resto)' }, { name: 'Nasi Putih', qty: 4 }, { name: 'Susu Kedelai', qty: 1 }] },
      { raw: 'Paket Keluarga (1 ekor, 4 teh), 4 Nasi, 1 Jeruk Nipis, 1 AM, 1 telur, 1 tahu tempe g, 1 krupuk', amount: 242000, method: 'cash', orderType: 'dineIn', table: 1,
        items: [{ name: 'Paket Keluarga (3-4 org)', qty: 1, notes: '1 Ekor + 4 Teh Tawar' }, { name: 'Nasi Putih', qty: 4 }, { name: 'Jeruk Nipis', qty: 1 }, { name: 'Air Mineral', qty: 1 }, { name: 'Telur Dadar', qty: 1 }, { name: 'Tahu Tempe Goreng', qty: 1 }, { name: 'Kerupuk', qty: 1 }] },
      { raw: 'Pesanan Grab (2 Jeruk Murni, 1 Rempelo)', amount: 66000, method: 'grab', orderType: 'takeaway',
        items: [{ name: 'Jeruk Murni', qty: 2 }, { name: 'Rempelo Ayam', qty: 1 }] },
      { raw: '1 Paket K (1 Ekor B, 2 teh, 2 AM), 1 tahu tempe g, 1 Sarang B, krupuk', amount: 242000, method: 'cash', orderType: 'dineIn', table: 2,
        items: [{ name: 'Paket Keluarga (3-4 org)', qty: 1, notes: '1 Ekor + 2 Teh + 2 AM' }, { name: 'Tahu Tempe Goreng', qty: 1 }, { name: 'Sarang Burung', qty: 1 }, { name: 'Kerupuk', qty: 1 }] },
    ],
    summary: { qris: 455000, cash: 484000, grab: 66000 },
  },
  // ============ 5 Mei (Selasa) ============
  {
    date: '2026-05-05', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 10 }, { name: 'DADA B', qty: 10 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 3 },
      { name: 'Ati', qty: 9 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 9 }, { name: 'Gasem A', qty: 5 },
      { name: 'Gasem D', qty: 2 }, { name: 'Semur D', qty: 5 }, { name: 'Gulai D', qty: 5 }, { name: 'Gulai B', qty: 2 },
      { name: 'Rawon', qty: 2 }, { name: 'Empal', qty: 10 }, { name: 'Bakwan', qty: 17 }, { name: 'Udang W', qty: 28 },
      { name: 'Ikan', qty: 1 }, { name: 'Sarang B', qty: 19 }, { name: 'Petai', qty: 19 },
    ],
    transactions: [
      { raw: '2 Paket A (Paha G, Dada G, Teh T)', amount: 100000, method: 'cash', orderType: 'dineIn', table: 3,
        items: [{ name: 'Paket A (1 org)', qty: 2, notes: 'Paha Goreng/Dada Goreng + Teh Tawar' }] },
      { raw: '3 Paket A (3 Paha 1G/2B, 3 Teh T), 1 Gurame', amount: 250000, method: 'cash', orderType: 'dineIn', table: 4,
        items: [{ name: 'Paket A (1 org)', qty: 3, notes: '3 Paha (1 Goreng/2 Bakar) + 3 Teh Tawar' }, { name: 'Gurame Bakar', qty: 1 }] },
      { raw: '2 Paket A (Paha B, Dada B), 2 Teh', amount: 100000, method: 'cash', orderType: 'dineIn', table: 5,
        items: [{ name: 'Paket A (1 org)', qty: 2, notes: 'Paha Bakar/Dada Bakar + Teh' }] },
    ],
    summary: { cash: 450000 },
  },
  // ============ 6 Mei (Rabu) ============
  {
    date: '2026-05-06', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 9 }, { name: 'DADA B', qty: 10 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 9 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 10 }, { name: 'Gasem D', qty: 2 },
      { name: 'Gasem A', qty: 5 }, { name: 'Semur D', qty: 5 }, { name: 'Gulai D', qty: 5 }, { name: 'Gulai B', qty: 2 },
      { name: 'Rawon', qty: 2 }, { name: 'Empal', qty: 10 }, { name: 'Bakwan', qty: 17 }, { name: 'Udang W', qty: 28 },
      { name: 'Ikan', qty: 2 }, { name: 'Sarang B', qty: 19 }, { name: 'Petai', qty: 19 },
    ],
    transactions: [
      { raw: 'PAKET A (Paha, Teh m), 1 PAKET C (Gule, Teh m), 1 Gasem D, 1 Bakwan P, 1 Es Teh H', amount: 158000, method: 'edc', bank: 'BCA', orderType: 'dineIn', table: 6,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Paha + Teh Manis' }, { name: 'Paket C (1 org)', qty: 1, notes: 'Gulai + Teh Manis' }, { name: 'Garang Asem Daging', qty: 1 }, { name: 'Bakwan Penyet', qty: 1 }, { name: 'Teh Tawar Biasa', qty: 1, notes: 'Panas' }] },
    ],
    summary: { edc: 158000 },
  },
  // ============ 7 Mei (Kamis) ============
  {
    date: '2026-05-07', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 10 }, { name: 'DADA B', qty: 10 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 7 }, { name: 'Rempelo', qty: 5 }, { name: 'Kepala', qty: 9 }, { name: 'Gasem D', qty: 1 },
      { name: 'Gasem A', qty: 5 }, { name: 'Semur D', qty: 5 }, { name: 'Gulai D', qty: 3 }, { name: 'Gulai B', qty: 2 },
      { name: 'Rawon', qty: 2 }, { name: 'Empal', qty: 10 }, { name: 'Bakwan', qty: 16 }, { name: 'Udang W', qty: 28 },
      { name: 'Ikan', qty: 2 }, { name: 'Sarang B', qty: 0 }, { name: 'Petai', qty: 19 },
    ],
    transactions: [
      { raw: '2 Paket A (Dada G, Dada B, 2 es teh m)', amount: 100000, method: 'edc', bank: 'BCA', orderType: 'dineIn', table: 7,
        items: [{ name: 'Paket A (1 org)', qty: 2, notes: 'Dada Goreng/Dada Bakar + Teh Manis' }] },
      { raw: '1 Gurami B, 6 Ayam Paha B, 1 Bakwan, 1 empal, 1 tahu tempe, 1 krupuk, 2 es jrk, 1 Paket A (Paha B, es teh m), 6 Nasi, 6 Es teh m', amount: 552000, method: 'edc', bank: 'BCA', orderType: 'dineIn', table: 8,
        items: [{ name: 'Gurame Bakar', qty: 1 }, { name: 'Paha Ayam Bakar', qty: 6 }, { name: 'Bakwan Penyet', qty: 1 }, { name: 'Empal Penyet', qty: 1 }, { name: 'Tahu Tempe Goreng', qty: 1 }, { name: 'Kerupuk', qty: 1 }, { name: 'Jeruk Peras', qty: 2 }, { name: 'Paket A (1 org)', qty: 1, notes: 'Paha Bakar + Teh Manis' }, { name: 'Nasi Putih', qty: 6 }, { name: 'Teh Manis Biasa', qty: 6 }] },
      { raw: '1 Dada BM, 1 Gasem A', amount: 60000, method: 'edc', bank: 'BCA', orderType: 'dineIn', table: 9,
        items: [{ name: 'Dada Ayam Bakar', qty: 1 }, { name: 'Garang Asem Ayam', qty: 1 }] },
      { raw: '1 Bakwan, 1 telur R, 1 Nasi p, 2 tahu tempe, 1 tempe, 1 es teh, 1 es jrk N, 1 Gurame B, 1 ekor ayam B, 2 tempe tahu', amount: 358000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 1,
        items: [{ name: 'Bakwan Penyet', qty: 1 }, { name: 'Telur Dadar', qty: 1 }, { name: 'Nasi Putih', qty: 1 }, { name: 'Tahu Tempe Goreng', qty: 2 }, { name: 'Tempe Goreng', qty: 1 }, { name: 'Teh Tawar Biasa', qty: 1 }, { name: 'Jeruk Nipis', qty: 1 }, { name: 'Gurame Bakar', qty: 1 }, { name: '1 Ekor Ayam Bakar Merah', qty: 1 }, { name: 'Tahu Tempe Goreng', qty: 2 }] },
      { raw: '2 udang w, 1 tahu tempe', amount: 330000, method: 'transfer', bank: 'BCA', orderType: 'dineIn', table: 2,
        items: [{ name: 'Udang Windu Bakar (isi 7)', qty: 2 }, { name: 'Tahu Tempe Goreng', qty: 1 }] },
      { raw: '1 Paket C Gulai D (1 AM)', amount: 80000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 3,
        items: [{ name: 'Paket C (1 org)', qty: 1, notes: 'Gulai Daging + Air Mineral' }, { name: 'Garang Asem Daging', qty: 1, notes: 'penyesuaian total' }] },
      { raw: '5 ekor Ayam Goreng', amount: 500000, method: 'cash', orderType: 'dineIn', table: 4,
        items: [{ name: '1 Ekor Ayam Goreng', qty: 5 }] },
      { raw: 'Krupuk', amount: 7000, method: 'cash', orderType: 'dineIn', table: 5,
        items: [{ name: 'Kerupuk', qty: 1 }] },
    ],
    summary: { edc: 712000, qris: 438000, cash: 507000, transfer: 330000 },
  },
  // ============ 8 Mei (Jumat) ============
  {
    date: '2026-05-08', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 23 }, { name: 'DADA B', qty: 20 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 9 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 10 }, { name: 'Gasem D', qty: 1 },
      { name: 'Gasem A', qty: 5 }, { name: 'Semur D', qty: 5 }, { name: 'Gulai D', qty: 3 }, { name: 'Gulai B', qty: 2 },
      { name: 'Rawon', qty: 2 }, { name: 'Bakwan', qty: 14 }, { name: 'Empal', qty: 9 }, { name: 'Udang W', qty: 14 },
      { name: 'Ikan', qty: 5 }, { name: 'Sarang B', qty: 10 }, { name: 'Petai', qty: 19 },
    ],
    transactions: [
      { raw: 'Paket K (1 ekor B/B), 3 teh, 1 AM, 1 T G', amount: 177000, method: 'qris', bank: 'Mandiri', orderType: 'dineIn', table: 6,
        items: [{ name: 'Paket Keluarga (3-4 org)', qty: 1, notes: '1 Ekor + 3 Teh + 1 AM' }, { name: 'Tahu Goreng', qty: 1 }] },
      { raw: '4 EKOR BM (Yuxia)', amount: 400000, method: 'transfer', bank: 'BCA', orderType: 'takeaway',
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 4, notes: 'pesanan Yuxia' }] },
      { raw: '2 AM', amount: 10000, method: 'qris', bank: 'Mandiri', orderType: 'dineIn', table: 7,
        items: [{ name: 'Air Mineral', qty: 2 }] },
    ],
    summary: { qris: 187000, transfer: 400000 },
  },
  // ============ 9 Mei (Sabtu) ============
  {
    date: '2026-05-09', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 14 }, { name: 'DADA B', qty: 12 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 3 },
      { name: 'Ati', qty: 9 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 10 }, { name: 'Gasem D', qty: 1 },
      { name: 'Gasem A', qty: 3 }, { name: 'Semur D', qty: 5 }, { name: 'Gulai D', qty: 2 }, { name: 'Gulai B', qty: 2 },
      { name: 'Rawon', qty: 2 }, { name: 'Bakwan', qty: 14 }, { name: 'Empal', qty: 9 }, { name: 'Udang W', qty: 19 },
      { name: 'Ikan', qty: 5 }, { name: 'Sarang B', qty: 10 }, { name: 'Petai', qty: 19 },
    ],
    transactions: [
      { raw: '2 Paket A (1 Paha B, 2 Dada G), 2 es teh', amount: 180000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 8,
        items: [{ name: 'Paket A (1 org)', qty: 3, notes: '1 Paha Bakar/2 Dada Goreng + 2 AM + Teh Manis' }, { name: 'Kerupuk Udang', qty: 2 }] },
      { raw: '1 Paket A (Dada B, Teh m), 1 Paket D (Teh m)', amount: 88000, method: 'cash', orderType: 'dineIn', table: 9,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Dada Bakar + Teh Manis' }, { name: 'Paket D (1 org)', qty: 1, notes: 'Teh Manis' }] },
      { raw: '1 Paket C (Gasem A, Teh m), 1 Paha B, 1 Nasi', amount: 80000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 1,
        items: [{ name: 'Paket C (1 org)', qty: 1, notes: 'Garang Asem Ayam + Teh Manis' }, { name: 'Paha Ayam Bakar', qty: 1 }, { name: 'Nasi Putih', qty: 1 }] },
    ],
    summary: { qris: 260000, cash: 88000 },
  },
  // ============ 10 Mei (Minggu) ============
  {
    date: '2026-05-10', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 12 }, { name: 'DADA B', qty: 15 }, { name: 'PAHA G', qty: 6 }, { name: 'DADA G', qty: 4 },
      { name: 'Ati', qty: 9 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 10 }, { name: 'Gasem A', qty: 3 },
      { name: 'Semur D', qty: 5 }, { name: 'Gulai D', qty: 1 }, { name: 'Gulai B', qty: 2 }, { name: 'Rawon', qty: 2 },
      { name: 'Bakwan', qty: 14 }, { name: 'Empal', qty: 4 }, { name: 'Udang W', qty: 14 }, { name: 'Ikan', qty: 4 },
      { name: 'Sarang B', qty: 10 }, { name: 'Petai', qty: 18 },
    ],
    transactions: [
      { raw: '1 Paket A (Dada B, Teh m), 1 Paket B (Dada G), 1 Dada B, 1 Nasi, 2 Teh M H, 1 Paket D (Empal, AM)', amount: 188000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 2,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Dada Bakar + Teh Manis' }, { name: 'Paket B (1 org)', qty: 1, notes: 'Dada Goreng' }, { name: 'Dada Ayam Bakar', qty: 1 }, { name: 'Nasi Putih', qty: 1 }, { name: 'Teh Manis Biasa', qty: 2, notes: 'Panas' }, { name: 'Paket D (1 org)', qty: 1, notes: 'Empal + Air Mineral' }] },
      { raw: '2 Paket D (2 Teh m), 2 Paket C (Gasem D, Rawon) (AM, Teh m H)', amount: 156000, method: 'cash', orderType: 'dineIn', table: 3,
        items: [{ name: 'Paket D (1 org)', qty: 2, notes: 'Teh Manis' }, { name: 'Paket C (1 org)', qty: 2, notes: 'Garang Asem Daging/Rawon + AM/Teh Manis Panas' }] },
      { raw: '1 Gurame B, 2 Ati B, 2 Teh T J, 1 Petai, 2 Nasi, 1 Krupuk', amount: 189000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 4,
        items: [{ name: 'Gurame Bakar', qty: 1 }, { name: 'Ati Ayam', qty: 2 }, { name: 'Teh Tawar Jumbo', qty: 2 }, { name: 'Petai Goreng', qty: 1 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Kerupuk', qty: 1 }] },
      { raw: '2 Paket B (2 Dada B)', amount: 80000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 5,
        items: [{ name: 'Paket B (1 org)', qty: 2, notes: 'Dada Bakar' }] },
      { raw: '2 Paket B (1 Paha B, Dada G), 1 Rempelo, 1 Ati, 2 Jeruk P, 1 Krupuk (gabung baris "0" - koreksi user)', amount: 165000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 6,
        items: [{ name: 'Paket B (1 org)', qty: 2, notes: 'Paha Bakar/Dada Goreng' }, { name: 'Rempelo Ayam', qty: 1 }, { name: 'Ati Ayam', qty: 1 }, { name: 'Jeruk Peras', qty: 2 }, { name: 'Kerupuk', qty: 1 }] },
      { raw: '1 Ekor B', amount: 144000, method: 'gojek', orderType: 'takeaway',
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 1, notes: 'GoFood' }] },
      { raw: '1 Paket C (Rawon, Teh m), 1 Paket B (Dada B, Teh m)', amount: 95000, method: 'edc', bank: 'BCA', orderType: 'dineIn', table: 7,
        items: [{ name: 'Paket C (1 org)', qty: 1, notes: 'Rawon + Teh Manis' }, { name: 'Paket B (1 org)', qty: 1, notes: 'Dada Bakar + Teh Manis' }, { name: 'Teh Manis Biasa', qty: 0, notes: 'penyesuaian' }] },
    ],
    summary: { qris: 622000, edc: 95000, cash: 156000, gojek: 144000 },
  },
  // ============ 11 Mei (Senin) ============
  {
    date: '2026-05-11', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 9 }, { name: 'DADA B', qty: 20 }, { name: 'PAHA G', qty: 6 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 6 }, { name: 'Rempelo', qty: 3 }, { name: 'Kepala', qty: 10 }, { name: 'Gasem D', qty: 3 },
      { name: 'Gasem A', qty: 4 }, { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 3 }, { name: 'Gule D', qty: 5 },
      { name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 4 }, { name: 'Udang W', qty: 42 }, { name: 'Bakwan', qty: 14 },
      { name: 'Empal', qty: 4 }, { name: 'Petai', qty: 19 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '2 EKOR BM (Yuxia)', amount: 200000, method: 'transfer', bank: 'BCA', orderType: 'takeaway',
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 2, notes: 'pesanan Yuxia, harga bulk' }] },
      { raw: '2 EKOR B (Yeni)', amount: 200000, method: 'transfer', bank: 'BCA', orderType: 'takeaway',
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 2, notes: 'pesanan Yeni, harga bulk' }] },
      { raw: '2 Paket B (2 Dada B)', amount: 80000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 8,
        items: [{ name: 'Paket B (1 org)', qty: 2, notes: 'Dada Bakar' }] },
      { raw: '1 Paket A (1 Dada B, 1 Teh m)', amount: 50000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 9,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Dada Bakar + Teh Manis' }] },
      { raw: '1 Paket B (Paha B / Teh T H)', amount: 48000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 1,
        items: [{ name: 'Paket B (1 org)', qty: 1, notes: 'Paha Bakar' }, { name: 'Teh Tawar Biasa', qty: 1, notes: 'Panas' }] },
      { raw: '1 Gurame, 1 Sayur Asem, 2 Nasi, 1 Teh T, 1 AM, 1 Teh M', amount: 158000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 2,
        items: [{ name: 'Gurame Bakar', qty: 1 }, { name: 'Sayur Asem', qty: 1 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Teh Tawar Biasa', qty: 1 }, { name: 'Air Mineral', qty: 1 }, { name: 'Teh Manis Biasa', qty: 1 }] },
    ],
    summary: { transfer: 400000, qris: 336000 },
  },
  // ============ 12 Mei (Selasa) ============
  {
    date: '2026-05-12', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 10 }, { name: 'DADA B', qty: 23 }, { name: 'PAHA G', qty: 5 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 8 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 10 }, { name: 'Gasem D', qty: 3 },
      { name: 'Gasem A', qty: 4 }, { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 3 }, { name: 'Gule D', qty: 5 },
      { name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 2 }, { name: 'Udang W', qty: 42 }, { name: 'Bakwan', qty: 14 },
      { name: 'Empal', qty: 4 }, { name: 'Petai', qty: 19 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '2 Paket A (Paha B, Dada B, AM, Teh manis), 3 Paket C (1 Gasem A, 2 Rawon), 2 AM (Teh M), 1/2 Tempe G', amount: 226000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 3,
        items: [{ name: 'Paket A (1 org)', qty: 2, notes: 'Paha/Dada Bakar + Air Mineral/Teh Manis' }, { name: 'Paket C (1 org)', qty: 3, notes: '1 Garang Asem Ayam/2 Rawon' }, { name: 'Air Mineral', qty: 2 }, { name: 'Tempe Goreng', qty: 1, notes: '1/2 porsi' }] },
      { raw: '1 Paket B (Dada BM)', amount: 40000, method: 'cash', orderType: 'dineIn', table: 4,
        items: [{ name: 'Paket B (1 org)', qty: 1, notes: 'Dada Bakar' }] },
      { raw: '1 Paket B (Dada B) Mentah', amount: 48000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 5,
        items: [{ name: 'Paket B (1 org)', qty: 1, notes: 'Dada Bakar - mentah' }, { name: 'Teh Tawar Biasa', qty: 1, notes: 'penyesuaian' }] },
      { raw: '2 Paket A (Dada B, Paha B, 2 Teh M), 1 Ati, 1 Susuk', amount: 120000, method: 'cash', orderType: 'dineIn', table: 6,
        items: [{ name: 'Paket A (1 org)', qty: 2, notes: 'Dada/Paha Bakar + Teh Manis' }, { name: 'Ati Ayam', qty: 1 }, { name: 'Susu Kedelai', qty: 1 }] },
    ],
    summary: { qris: 274000, cash: 160000 },
  },
  // ============ 13 Mei (Rabu) ============
  {
    date: '2026-05-13', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 10 }, { name: 'DADA B', qty: 19 }, { name: 'PAHA G', qty: 7 }, { name: 'DADA G', qty: 7 },
      { name: 'Ati', qty: 7 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 8 }, { name: 'Gasem D', qty: 3 },
      { name: 'Gasem A', qty: 3 }, { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 3 }, { name: 'Gule D', qty: 5 },
      { name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 2 }, { name: 'Udang W', qty: 42 }, { name: 'Bakwan', qty: 14 },
      { name: 'Empal', qty: 4 }, { name: 'Petai', qty: 19 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '2 EKOR G + Gojek 20.000 (Mami)', amount: 220000, method: 'transfer', bank: 'BCA', orderType: 'takeaway',
        items: [{ name: '1 Ekor Ayam Goreng', qty: 2, notes: 'pesanan Mami + ongkir Gojek 20rb' }] },
      { raw: '1 Paket C (Gule D, Teh M), 1 Paket D (Empal, AM), 1 Nasi, 1 Dada G', amount: 118000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 7,
        items: [{ name: 'Paket C (1 org)', qty: 1, notes: 'Gulai Daging + Teh Manis' }, { name: 'Paket D (1 org)', qty: 1, notes: 'Empal + Air Mineral' }, { name: 'Nasi Putih', qty: 1 }, { name: 'Dada Ayam Goreng', qty: 1 }] },
    ],
    summary: { transfer: 220000, qris: 118000 },
  },
  // ============ 14 Mei (Kamis) ============
  {
    date: '2026-05-14', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 10 }, { name: 'DADA B', qty: 19 }, { name: 'PAHA G', qty: 3 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 7 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 9 }, { name: 'Gasem D', qty: 3 },
      { name: 'Gasem A', qty: 3 }, { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 3 }, { name: 'Gule D', qty: 5 },
      { name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 2 }, { name: 'Udang W', qty: 42 }, { name: 'Bakwan', qty: 14 },
      { name: 'Empal', qty: 3 }, { name: 'Petai', qty: 19 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '2 Ekor B', amount: 200000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 8,
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 2, notes: 'harga bulk' }] },
      { raw: 'Susu K', amount: 15000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 9,
        items: [{ name: 'Susu Kedelai', qty: 1 }] },
      { raw: 'Paket C (Bakwan P, AM), 2 Teh M, 1 Susu K', amount: 75000, method: 'cash', orderType: 'dineIn', table: 1,
        items: [{ name: 'Paket C (1 org)', qty: 1, notes: 'Bakwan Penyet + Air Mineral' }, { name: 'Teh Manis Biasa', qty: 2 }, { name: 'Susu Kedelai', qty: 1 }] },
      { raw: '1 Paket A (Dada B, Teh M), 1 Udang W, 2 Nasi, 1 Teh M, 1 Krupuk', amount: 245000, method: 'cash', orderType: 'dineIn', table: 2,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Dada Bakar + Teh Manis' }, { name: 'Udang Windu Bakar (isi 7)', qty: 1 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Teh Manis Biasa', qty: 1 }, { name: 'Kerupuk Udang', qty: 1 }] },
      { raw: '1 Ekor B', amount: 120000, method: 'transfer', bank: 'BCA', orderType: 'dineIn', table: 3,
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 1 }] },
      { raw: 'Paha C', amount: 30000, method: 'cash', orderType: 'dineIn', table: 4,
        items: [{ name: 'Paha Ayam Bakar', qty: 1 }] },
    ],
    summary: { qris: 215000, cash: 350000, transfer: 120000 },
  },
  // ============ 15 Mei (Jumat) ============
  {
    date: '2026-05-15', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 32 }, { name: 'DADA B', qty: 33 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 0 }, { name: 'Rempelo', qty: 0 }, { name: 'Kepala', qty: 10 }, { name: 'Gasem D', qty: 1 },
      { name: 'Gasem A', qty: 3 }, { name: 'Semur D', qty: 4 }, { name: 'Rawon', qty: 2 }, { name: 'Gule D', qty: 4 },
      { name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 2 }, { name: 'Udang W', qty: 28 }, { name: 'Bakwan', qty: 13 },
      { name: 'Empal', qty: 3 }, { name: 'Petai', qty: 19 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '9 Ekor B, 4 Udang W (Fendi, Eming)', amount: 1680000, method: 'transfer', bank: 'BCA', orderType: 'takeaway',
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 9 }, { name: 'Udang Windu Bakar (isi 7)', qty: 4 }] },
      { raw: '1 Ekor, 1 Semur, 1 Gasem, 1 Gule, 1 Rawon (tanpa Paha B - koreksi user)', amount: 240000, method: 'transfer', bank: 'BCA', orderType: 'dineIn', table: 5,
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 1 }, { name: 'Semur Daging', qty: 1 }, { name: 'Garang Asem Ayam', qty: 1 }, { name: 'Gulai Daging', qty: 1 }, { name: 'Rawon Daging', qty: 1 }] },
      { raw: '2 Paket A (2 Dada B, 2 Teh M), 2 Susuk', amount: 130000, method: 'edc', bank: 'BCA', orderType: 'dineIn', table: 6,
        items: [{ name: 'Paket A (1 org)', qty: 2, notes: 'Dada Bakar + Teh Manis' }, { name: 'Susu Kedelai', qty: 2 }] },
      { raw: '1 Paket Hemat (Dada B, AM), 1 Paket C (Gasem D, AM), Jeruk Peras, 1 Krupuk', amount: 105000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 7,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Dada Bakar + Air Mineral' }, { name: 'Paket C (1 org)', qty: 1, notes: 'Garang Asem Daging + Air Mineral' }, { name: 'Jeruk Peras', qty: 1 }, { name: 'Kerupuk', qty: 1 }] },
      { raw: '1 Paket A (Dada B, Teh M)', amount: 50000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 8,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Dada Bakar + Teh Manis' }] },
    ],
    summary: { transfer: 1920000, edc: 130000, qris: 155000 },
  },
  // ============ 16 Mei (Sabtu) ============
  {
    date: '2026-05-16', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 10 }, { name: 'DADA B', qty: 10 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 17 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 5 }, { name: 'Gasem D', qty: 2 },
      { name: 'Gasem A', qty: 3 }, { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 2 }, { name: 'Gule D', qty: 4 },
      { name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 2 }, { name: 'Udang W', qty: 17 }, { name: 'Bakwan', qty: 13 },
      { name: 'Empal', qty: 3 }, { name: 'Petai', qty: 19 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '1 EKOR B, 2 Nasi, 1 Teh T, AM, 1 Krupuk', amount: 168000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 9,
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 1 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Teh Tawar Biasa', qty: 1 }, { name: 'Air Mineral', qty: 1 }, { name: 'Kerupuk Udang', qty: 1 }] },
      { raw: '1 Krupuk', amount: 15000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 1,
        items: [{ name: 'Kerupuk Udang', qty: 1 }] },
    ],
    summary: { qris: 183000 },
  },
  // ============ 17 Mei (Minggu) ============
  {
    date: '2026-05-17', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 25 }, { name: 'DADA B', qty: 25 }, { name: 'DADA G', qty: 2 }, { name: 'Ati', qty: 6 },
      { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 6 }, { name: 'Gasem D', qty: 2 }, { name: 'Gasem A', qty: 3 },
      { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 2 }, { name: 'Gule D', qty: 4 }, { name: 'Gule B', qty: 2 },
      { name: 'Ikan', qty: 2 }, { name: 'Udang W', qty: 7 }, { name: 'Bakwan', qty: 13 }, { name: 'Empal', qty: 3 },
      { name: 'Petai', qty: 19 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '1 PAKET K (1 EKOR B, 2 AM, 2 TEH T), 1 ATI, 1 SAYUR ASEM, 1 TAHU G', amount: 180000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 2,
        items: [{ name: 'Paket Keluarga (3-4 org)', qty: 1, notes: '1 Ekor + 2 AM + 2 Teh Tawar' }, { name: 'Ati Ayam', qty: 1 }, { name: 'Sayur Asem', qty: 1 }, { name: 'Tahu Goreng', qty: 1 }] },
      { raw: '2 PAKET A (2 DADA B, 2 AM), 1 EKOR B', amount: 220000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 3,
        items: [{ name: 'Paket A (1 org)', qty: 2, notes: 'Dada Bakar + Air Mineral' }, { name: '1 Ekor Ayam Bakar Merah', qty: 1 }] },
      { raw: '1 NASI, 1 PAHA B', amount: 40000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 4,
        items: [{ name: 'Nasi Putih', qty: 1 }, { name: 'Paha Ayam Bakar', qty: 1 }] },
      { raw: '1 Empal P, 1 Gurame B, 2 jeruk N, 2 Jeruk P, 3 NASI, 1 EKOR, 1 Krupuk, 1 AM', amount: 345000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 5,
        items: [{ name: 'Empal Penyet', qty: 1 }, { name: 'Gurame Bakar', qty: 1 }, { name: 'Jeruk Nipis', qty: 2 }, { name: 'Jeruk Peras', qty: 2 }, { name: 'Nasi Putih', qty: 3 }, { name: '1 Ekor Ayam Bakar Merah', qty: 1 }, { name: 'Kerupuk', qty: 1 }, { name: 'Air Mineral', qty: 1 }] },
      { raw: '1 PAHA B, 1 NASI', amount: 40000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 6,
        items: [{ name: 'Paha Ayam Bakar', qty: 1 }, { name: 'Nasi Putih', qty: 1 }] },
      { raw: '9 DADA B (Dibatalkan/Dicoret)', amount: 270000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 7,
        items: [{ name: 'Dada Ayam Bakar', qty: 9, notes: 'baris dicoret di buku tapi tetap masuk summary (keep paid per keputusan #F)' }] },
      { raw: '1 udang w, 2 PAKET A (DADA G, DADA B, 2 TEH M), 2 PAKET C (2 RAWON, AM, TEH M), 1 Bakwan P, 1 Jeruk N, 2 NASI, 1 DADA C, 1 ES TEH M', amount: 436000, method: 'edc', bank: 'BCA', orderType: 'dineIn', table: 8,
        items: [{ name: 'Udang Windu Bakar (isi 7)', qty: 1 }, { name: 'Paket A (1 org)', qty: 2, notes: 'Dada Goreng/Bakar + Teh Manis' }, { name: 'Paket C (1 org)', qty: 2, notes: 'Rawon + AM/Teh Manis' }, { name: 'Bakwan Penyet', qty: 1 }, { name: 'Jeruk Nipis', qty: 1 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Dada Ayam Bakar', qty: 1 }, { name: 'Teh Manis Biasa', qty: 1 }] },
    ],
    summary: { qris: 1095000, edc: 436000 },
  },
  // ============ 18 Mei (Senin) ============
  {
    date: '2026-05-18', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 10 }, { name: 'DADA B', qty: 10 }, { name: 'PAHA G', qty: 6 }, { name: 'DADA G', qty: 4 },
      { name: 'Ati', qty: 6 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 6 }, { name: 'Gasem D', qty: 2 },
      { name: 'Gasem A', qty: 3 }, { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 2 }, { name: 'Gule D', qty: 4 },
      { name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 1 }, { name: 'Udang W', qty: 21 }, { name: 'Bakwan', qty: 12 },
      { name: 'Empal', qty: 2 }, { name: 'Petai', qty: 19 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '2 Paket B (2 Dada B), 1 AM, 1 es th jumbo, 1 telur dadar, 1 tahu tempe G, 2 sambal tomat, 1 Nasi, 1 th P, 2 krupuk C', amount: 192000, method: 'cash', orderType: 'dineIn', table: 9,
        items: [{ name: 'Paket B (1 org)', qty: 2, notes: 'Dada Bakar' }, { name: 'Air Mineral', qty: 1 }, { name: 'Teh Tawar Jumbo', qty: 1 }, { name: 'Telur Dadar', qty: 1 }, { name: 'Tahu Tempe Goreng', qty: 1 }, { name: 'Sambal Tomat', qty: 2 }, { name: 'Nasi Putih', qty: 1 }, { name: 'Teh Tawar Biasa', qty: 1, notes: 'Panas' }, { name: 'Kerupuk Udang', qty: 2 }] },
      { raw: '1 DADA B, 1 Gasem A', amount: 60000, method: 'edc', bank: 'BCA', orderType: 'dineIn', table: 1,
        items: [{ name: 'Dada Ayam Bakar', qty: 1 }, { name: 'Garang Asem Ayam', qty: 1 }] },
    ],
    summary: { cash: 192000, edc: 60000 },
  },
  // ============ 19 Mei (Selasa) ============
  {
    date: '2026-05-19', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 10 }, { name: 'DADA B', qty: 10 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 6 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 6 }, { name: 'Gasem D', qty: 2 },
      { name: 'Gasem A', qty: 2 }, { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 2 }, { name: 'Gule D', qty: 4 },
      { name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 6 }, { name: 'Udang W', qty: 21 }, { name: 'Bakwan', qty: 12 },
      { name: 'Empal', qty: 2 }, { name: 'Petai', qty: 19 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '1 Gurame, 1 Sayur Asem, 2 Nasi, 1 PAHA G, 2 jeruk peras, 1 krupuk', amount: 210000, method: 'transfer', bank: 'BCA', orderType: 'dineIn', table: 2,
        items: [{ name: 'Gurame Bakar', qty: 1 }, { name: 'Sayur Asem', qty: 1 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Paha Ayam Goreng', qty: 1 }, { name: 'Jeruk Peras', qty: 2 }, { name: 'Kerupuk', qty: 1 }] },
      { raw: '1 Gurame, 1 Sayur Asem, 1 Nasi, 2 AM, 1 Pete, 1 Tahu Tempe G, 1 PAKET D (Empal P, Teh M)', amount: 167000, method: 'cash', orderType: 'dineIn', table: 3,
        items: [{ name: 'Gurame Bakar', qty: 1 }, { name: 'Sayur Asem', qty: 1 }, { name: 'Nasi Putih', qty: 1 }, { name: 'Air Mineral', qty: 2 }, { name: 'Petai Goreng', qty: 1 }, { name: 'Tahu Tempe Goreng', qty: 1 }] },
      { raw: '1 PAKET D (Empal), 1 PAKET B (DADA G), 1 Empal P, 1 Teh M, 1 Teh T', amount: 121000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 4,
        items: [{ name: 'Paket D (1 org)', qty: 1, notes: 'Empal' }, { name: 'Paket B (1 org)', qty: 1, notes: 'Dada Goreng' }, { name: 'Empal Penyet', qty: 1 }, { name: 'Teh Manis Biasa', qty: 1 }, { name: 'Teh Tawar Biasa', qty: 1 }] },
      { raw: '1 PAKET C (RAWON, Teh M), 1 PAKET B (DADA B), 1 Teh M, 1 AM', amount: 100000, method: 'cash', orderType: 'dineIn', table: 5,
        items: [{ name: 'Paket C (1 org)', qty: 1, notes: 'Rawon + Teh Manis' }, { name: 'Paket B (1 org)', qty: 1, notes: 'Dada Bakar' }, { name: 'Teh Manis Biasa', qty: 1 }, { name: 'Air Mineral', qty: 1 }] },
    ],
    summary: { transfer: 210000, cash: 267000, qris: 121000 },
  },
  // ============ 20 Mei (Rabu) ============
  {
    date: '2026-05-20', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 10 }, { name: 'DADA B', qty: 13 }, { name: 'DADA G', qty: 2 }, { name: 'Ati', qty: 6 },
      { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 5 }, { name: 'Gasem D', qty: 1 }, { name: 'Gasem A', qty: 2 },
      { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 4 }, { name: 'Gule D', qty: 4 }, { name: 'Gule B', qty: 2 },
      { name: 'Ikan', qty: 4 }, { name: 'Udang W', qty: 21 }, { name: 'Bakwan', qty: 12 }, { name: 'Petai', qty: 18 },
      { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '1 EKOR B (Gojek)', amount: 144000, method: 'grab', orderType: 'takeaway',
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 1, notes: 'GrabFood' }] },
      { raw: '1 Paket A (Paha B, Teh M), 1 Paket C (Gasem D)', amount: 90000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 6,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Paha Bakar + Teh Manis' }, { name: 'Paket C (1 org)', qty: 1, notes: 'Garang Asem Daging' }] },
      { raw: '1 Paket A (Paha B, Teh M), 1 Paket C (Gasem A, Teh M), 1 Paha B, 1 DADA B, 1 TEH M', amount: 160000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 7,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Paha Bakar + Teh Manis' }, { name: 'Paket C (1 org)', qty: 1, notes: 'Garang Asem Ayam + Teh Manis' }, { name: 'Paha Ayam Bakar', qty: 1 }, { name: 'Dada Ayam Bakar', qty: 1 }, { name: 'Teh Manis Biasa', qty: 1 }] },
    ],
    summary: { grab: 144000, qris: 250000 },
  },
  // ============ 21 Mei (Kamis) ============
  {
    date: '2026-05-21', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 20 }, { name: 'DADA B', qty: 20 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 6 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 5 }, { name: 'Gasem D', qty: 0 },
      { name: 'Gasem A', qty: 1 }, { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 4 }, { name: 'Gule D', qty: 4 },
      { name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 4 }, { name: 'Udang W', qty: 21 }, { name: 'Bakwan', qty: 12 },
      { name: 'Petai', qty: 17 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '3 EKOR B', amount: 360000, method: 'transfer', bank: 'BCA', orderType: 'dineIn', table: 8,
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 3 }] },
      // OCR koreksi: tertulis 305k, tapi item (240+100+30+15=385) + summary buku (qris 541=385+156) konfirmasi 385k.
      { raw: '2 EKOR, 1 Ikan, 2 jeruk peras, 1 Krupuk', amount: 385000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 9,
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 2 }, { name: 'Gurame Bakar', qty: 1 }, { name: 'Jeruk Peras', qty: 2 }, { name: 'Kerupuk Udang', qty: 1 }] },
      // #G Inhaler 35k DI-SKIP (OCR error) → cash hari ini jadi 182k ≠ 217k buku (di-flag)
      { raw: 'PAKET A (DADA B, TEH M), 1 PAKET B (DADA B), 2 Paket C (Gasem G, Gule D), 1 Tahu Tempe G', amount: 182000, method: 'cash', orderType: 'dineIn', table: 1,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Dada Bakar + Teh Manis' }, { name: 'Paket B (1 org)', qty: 1, notes: 'Dada Bakar' }, { name: 'Paket C (1 org)', qty: 2, notes: 'Garang Asem/Gulai Daging' }, { name: 'Tahu Tempe Goreng', qty: 1 }] },
      { raw: '1 Gurame B, 2 NASI, 2 Teh T, 1 Petai', amount: 156000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 2,
        items: [{ name: 'Gurame Bakar', qty: 1 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Teh Tawar Biasa', qty: 2 }, { name: 'Petai Goreng', qty: 1 }] },
    ],
    summary: { transfer: 360000, cash: 182000, qris: 541000 },
  },
  // ============ 22 Mei (Jumat) ============
  {
    date: '2026-05-22', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 20 }, { name: 'DADA B', qty: 20 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 6 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 5 }, { name: 'Gasem D', qty: 0 },
      { name: 'Gasem A', qty: 1 }, { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 4 }, { name: 'Gule D', qty: 4 },
      { name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 2 }, { name: 'Udang W', qty: 21 }, { name: 'Bakwan', qty: 12 },
      { name: 'Petai', qty: 17 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '5 Paket B (3 dada, 2 paha), 1 Krupuk', amount: 215000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 3,
        items: [{ name: 'Paket B (1 org)', qty: 5, notes: '3 Dada / 2 Paha' }, { name: 'Kerupuk Udang', qty: 1 }] },
      { raw: '1 Paket A (Paha BM, Teh M), 1 Paket B (Paha B)', amount: 90000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 4,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Paha Bakar + Teh Manis' }, { name: 'Paket B (1 org)', qty: 1, notes: 'Paha Bakar' }] },
      { raw: '1 Gasem A', amount: 30000, method: 'edc', bank: 'BCA', orderType: 'dineIn', table: 5,
        items: [{ name: 'Garang Asem Ayam', qty: 1 }] },
      { raw: '1 Udang W B, 1 Sayur Asem, 1 Tahu Tempe G, 2 Nasi, 1 AM, Jeruk N', amount: 212000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 6,
        items: [{ name: 'Udang Windu Bakar (isi 7)', qty: 1 }, { name: 'Sayur Asem', qty: 1 }, { name: 'Tahu Tempe Goreng', qty: 1 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Air Mineral', qty: 1 }, { name: 'Jeruk Nipis', qty: 1 }] },
    ],
    summary: { qris: 517000, edc: 30000 },
  },
  // ============ 23 Mei (Sabtu) ============
  {
    date: '2026-05-23', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 15 }, { name: 'DADA B', qty: 16 }, { name: 'PAHA G', qty: 2 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 6 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 6 }, { name: 'Gasem D', qty: 0 },
      { name: 'Gasem A', qty: 4 }, { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 4 }, { name: 'Gule D', qty: 4 },
      { name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 2 }, { name: 'Udang W', qty: 14 }, { name: 'Bakwan', qty: 12 },
      { name: 'Petai', qty: 17 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '1 EKOR B', amount: 120000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 7,
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 1 }] },
      { raw: '3 Paket A (1 DADA B, 2 PAHA B, 3 AM), 1 Jeruk Nipis, 1 Jeruk Peras, 1 Krupuk', amount: 190000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 8,
        items: [{ name: 'Paket A (1 org)', qty: 3, notes: '1 Dada/2 Paha Bakar + 3 Air Mineral' }, { name: 'Jeruk Nipis', qty: 1 }, { name: 'Jeruk Peras', qty: 1 }, { name: 'Kerupuk', qty: 1 }] },
      { raw: '1 Paket A (DADA G, TEH M), 1 Paket B (DADA B), 1 Jeruk N', amount: 100000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 9,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Dada Goreng + Teh Manis' }, { name: 'Paket B (1 org)', qty: 1, notes: 'Dada Bakar' }, { name: 'Jeruk Nipis', qty: 1 }] },
      { raw: '1 EKOR B, 1 PAHA B M, 1 TAHU G, 1 Gule B, 3 REMPELO G, 2 NASI, 1 TEH T H, 1 SUSUK', amount: 248000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 1,
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 1 }, { name: 'Paha Ayam Bakar', qty: 1 }, { name: 'Tahu Goreng', qty: 1 }, { name: 'Gulai Babat', qty: 1 }, { name: 'Rempelo Ayam', qty: 3 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Teh Tawar Biasa', qty: 1, notes: 'Panas' }, { name: 'Susu Kedelai', qty: 1 }] },
      { raw: '1 Gurame B, 2 NASI, 1 Paket B (DADA B), 1 TEH T', amount: 168000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 2,
        items: [{ name: 'Gurame Bakar', qty: 1 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Paket B (1 org)', qty: 1, notes: 'Dada Bakar' }, { name: 'Teh Tawar Biasa', qty: 1 }] },
      { raw: '2 PAHA B, 2 NASI, 1 SUSUK, 1 Jeruk P', amount: 110000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 3,
        items: [{ name: 'Paha Ayam Bakar', qty: 2 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Susu Kedelai', qty: 1 }, { name: 'Jeruk Peras', qty: 1 }] },
      { raw: '1 DADA G Penyet, 1 Tahu Tempe P, 1 Gasem A, 1 DADA B, 1 Jeruk N, 1 NASI, 4 AM, 1 Bakwan P, 2 Krupuk, 1 PAHA G', amount: 240000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 4,
        items: [{ name: 'Dada Ayam Goreng', qty: 1 }, { name: 'Tahu Tempe Penyet', qty: 1 }, { name: 'Garang Asem Ayam', qty: 1 }, { name: 'Dada Ayam Bakar', qty: 1 }, { name: 'Jeruk Nipis', qty: 1 }, { name: 'Nasi Putih', qty: 1 }, { name: 'Air Mineral', qty: 4 }, { name: 'Bakwan Penyet', qty: 1 }, { name: 'Kerupuk', qty: 2 }, { name: 'Paha Ayam Goreng', qty: 1 }] },
    ],
    summary: { qris: 1176000 },
  },
  // ============ 24 Mei (Minggu) ============
  {
    date: '2026-05-24', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 15 }, { name: 'DADA B', qty: 15 }, { name: 'PAHA G', qty: 4 }, { name: 'DADA G', qty: 1 },
      { name: 'Ati', qty: 2 }, { name: 'Rempelo', qty: 4 }, { name: 'Kepala', qty: 8 }, { name: 'Gasem D', qty: 0 },
      { name: 'Gasem A', qty: 3 }, { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 4 }, { name: 'Gule D', qty: 4 },
      { name: 'Gule B', qty: 1 }, { name: 'Ikan', qty: 1 }, { name: 'Udang W', qty: 14 }, { name: 'Bakwan', qty: 11 },
      { name: 'Empal', qty: 2 }, { name: 'Petai', qty: 17 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '2 PAHA G, 2 NASI, 2 SUSUK, 1 AM, 1 Krupuk, 1 Sayur Asem', amount: 145000, method: 'cash', orderType: 'dineIn', table: 5,
        items: [{ name: 'Paha Ayam Goreng', qty: 2 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Susu Kedelai', qty: 2 }, { name: 'Air Mineral', qty: 1 }, { name: 'Kerupuk', qty: 1 }, { name: 'Sayur Asem', qty: 1 }] },
      { raw: '1 EKOR B', amount: 120000, method: 'edc', bank: 'BCA', orderType: 'dineIn', table: 6,
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 1 }] },
      { raw: '1 Paket A (DADA G, AM)', amount: 50000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 7,
        items: [{ name: 'Paket A (1 org)', qty: 1, notes: 'Dada Goreng + Air Mineral' }] },
    ],
    summary: { cash: 145000, edc: 120000, qris: 50000 },
  },
  // ============ 25 Mei (Senin) ============
  {
    date: '2026-05-25', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 12 }, { name: 'DADA B', qty: 13 }, { name: 'PAHA G', qty: 4 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 4 }, { name: 'Rempelo', qty: 2 }, { name: 'Kepala', qty: 5 }, { name: 'Gasem D', qty: 0 },
      { name: 'Gasem A', qty: 3 }, { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 4 }, { name: 'Gule D', qty: 4 },
      { name: 'Gule B', qty: 1 }, { name: 'Ikan', qty: 1 }, { name: 'Udang W', qty: 14 }, { name: 'Bakwan', qty: 11 },
      { name: 'Petai', qty: 17 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '1 Gurame B', amount: 100000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 8,
        items: [{ name: 'Gurame Bakar', qty: 1 }] },
      { raw: '1 PAHA B, 2 NASI, 1 Gasem A, 1 TEH M H, 1 TAHU GORENG, 1 Krupuk', amount: 115000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 9,
        items: [{ name: 'Paha Ayam Bakar', qty: 1 }, { name: 'Nasi Putih', qty: 2 }, { name: 'Garang Asem Ayam', qty: 1 }, { name: 'Teh Manis Biasa', qty: 1, notes: 'Panas' }, { name: 'Tahu Goreng', qty: 1 }, { name: 'Kerupuk', qty: 1 }] },
      { raw: '3 PAKET C (Gasem A, 1 Bakwan, 2 Teh M, 1 AM)', amount: 120000, method: 'edc', bank: 'BCA', orderType: 'dineIn', table: 1,
        items: [{ name: 'Paket C (1 org)', qty: 3, notes: 'Garang Asem Ayam/Bakwan + Teh Manis/AM' }] },
      { raw: '1 EKOR B, 1 NASI, 1 Sayur Asem', amount: 145000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 2,
        items: [{ name: '1 Ekor Ayam Bakar Merah', qty: 1 }, { name: 'Nasi Putih', qty: 1 }, { name: 'Sayur Asem', qty: 1 }] },
    ],
    summary: { qris: 360000, edc: 120000 },
  },
  // ============ 26 Mei (Selasa) ============
  {
    date: '2026-05-26', cashier: 'Chen Hong', openingCash: 200000,
    stock: [
      { name: 'PAHA B', qty: 10 }, { name: 'DADA B', qty: 13 }, { name: 'PAHA G', qty: 4 }, { name: 'DADA G', qty: 2 },
      { name: 'Ati', qty: 4 }, { name: 'Rempelo', qty: 2 }, { name: 'Kepala', qty: 5 }, { name: 'Gasem D', qty: 3 },
      { name: 'Gasem A', qty: 1 }, { name: 'Semur D', qty: 4 }, { name: 'Rawon', qty: 4 }, { name: 'Gule D', qty: 4 },
      { name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 4 }, { name: 'Udang W', qty: 14 }, { name: 'Bakwan', qty: 11 },
      { name: 'Petai', qty: 17 }, { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: '2 PAKET C (Semur D, Gasem A), 1 Krupuk', amount: 95000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 3,
        items: [{ name: 'Paket C (1 org)', qty: 2, notes: 'Semur Daging/Garang Asem Ayam' }, { name: 'Kerupuk Udang', qty: 1 }] },
      { raw: '1 DADA B, 1 DADA G', amount: 60000, method: 'qris', bank: 'BCA', orderType: 'dineIn', table: 4,
        items: [{ name: 'Dada Ayam Bakar', qty: 1 }, { name: 'Dada Ayam Goreng', qty: 1 }] },
      { raw: '10 PAKET B (3 DADA B, 7 DADA G) (Pesanan Nonik Cucu) Gojek 16.000', amount: 416000, method: 'transfer', bank: 'BCA', orderType: 'takeaway',
        items: [{ name: 'Paket B (1 org)', qty: 10, notes: '3 Dada Bakar/7 Dada Goreng, pesanan Nonik Cucu + ongkir Gojek 16rb' }] },
      { raw: '1 AM', amount: 5000, method: 'cash', orderType: 'dineIn', table: 5,
        items: [{ name: 'Air Mineral', qty: 1 }] },
    ],
    summary: { qris: 155000, transfer: 416000, cash: 5000 },
  },
  // ============ 27 Mei (Rabu) ============
  {
    date: '2026-05-27', cashier: 'Bryant', openingCash: 200000,
    stock: [
      { name: 'DADA B', qty: 17 }, { name: 'PAHA B', qty: 10 }, { name: 'PAHA G', qty: 4 }, { name: 'DADA G', qty: 6 },
      { name: 'Ati', qty: 4 }, { name: 'Rempelo', qty: 2 }, { name: 'Kepala', qty: 5 }, { name: 'Gasem D', qty: 3 },
      { name: 'Semur D', qty: 5 }, { name: 'Rawon', qty: 4 }, { name: 'Gule D', qty: 4 }, { name: 'Gule B', qty: 2 },
      { name: 'Ikan', qty: 4 }, { name: 'Udang W', qty: 14 }, { name: 'Bakwan', qty: 11 }, { name: 'Petai', qty: 17 },
      { name: 'Sarang B', qty: 10 },
    ],
    transactions: [
      { raw: 'Udang W B, 1 Sayur Asem (Theo) ongkir 20.000', amount: 185000, method: 'transfer', bank: 'BCA', orderType: 'takeaway',
        items: [{ name: 'Udang Windu Bakar (isi 7)', qty: 1, notes: 'pesanan Theo + ongkir 20rb' }, { name: 'Sayur Asem', qty: 1 }] },
    ],
    summary: { transfer: 185000 },
  },
]
