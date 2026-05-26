# Daftar Menu - Ayam Bakar Banjar Monosuko

> Sumber kebenaran tunggal katalog menu ada di
> [`backend/prisma/menu-catalog.ts`](../backend/prisma/menu-catalog.ts).
> File ini ringkasannya untuk referensi cetak/dokumentasi.
>
> Untuk sinkronisasi ke DB yang sudah berisi data:
> `cd backend && npm run menu:update`. Untuk DB fresh: `npm run db:seed`.

## Signature Ayam Bakar
| Menu | Harga (Rp) |
|------|------------|
| 1 Ekor Ayam Bakar Merah | 120.000 |
| 1 Ekor Ayam Bakar Kecap | 120.000 |
| 1 Ekor Ayam Goreng | 120.000 |
| Paha Ayam Bakar | 30.000 |
| Paha Ayam Goreng | 30.000 |
| Dada Ayam Bakar | 30.000 |
| Dada Ayam Goreng | 30.000 |
| Kepala Ayam (per biji) | 2.500 |

## Seafood
| Menu | Harga (Rp) |
|------|------------|
| Udang Windu Bakar (isi 7) | 150.000 |
| Udang Windu Goreng (isi 7) | 150.000 |
| Udang Promo (isi 5) | 30.000 |
| Gurame Bakar | 100.000 |
| Gurame Goreng | 100.000 |
| Ati Ayam (per tusuk) | 5.000 |
| Rempelo Ayam (per tusuk) | 5.000 |

## Sayur & Sup
| Menu | Harga (Rp) |
|------|------------|
| Cah Kangkung | 20.000 |
| Sayur Asem | 15.000 |
| Ayam Tauco | 35.000 |
| Garang Asem Ayam | 30.000 |
| Garang Asem Daging | 30.000 |
| Rawon Daging | 30.000 |
| Semur Daging | 30.000 |
| Gulai Daging | 30.000 |
| Gulai Babat | 30.000 |

## Side Dish
| Menu | Harga (Rp) |
|------|------------|
| Empal Penyet | 25.000 |
| Bakwan Penyet | 30.000 |
| Petai Goreng | 20.000 |
| Tahu Tempe Penyet | 20.000 |
| Tahu Tempe Goreng | 12.000 |
| Tahu Goreng | 10.000 |
| Tempe Goreng | 10.000 |
| Telur Mata Sapi | 10.000 |
| Telur Dadar | 10.000 |
| Nasi Putih | 10.000 |
| Nasi Goreng | 15.000 |
| Sambal Terasi | 5.000 |
| Sambal Tomat | 5.000 |

## Minuman
| Menu | Harga (Rp) |
|------|------------|
| Sarang Burung | 80.000 |
| Air Mineral | 5.000 |
| Teh Tawar Biasa | 8.000 |
| Teh Tawar Jumbo | 12.000 |
| Teh Manis Biasa | 10.000 |
| Teh Manis Jumbo | 15.000 |
| Es Sirup | 10.000 |
| Jeruk Nipis | 10.000 |
| Es Degan | 15.000 |
| Jeruk Peras | 15.000 |
| Jeruk Murni | 25.000 |
| Kopi | 15.000 |
| Susu Kedelai | 15.000 |
| Cincau | 12.000 |

## Paket Hemat
| Menu | Harga (Rp) | Isi |
|------|------------|-----|
| Paket Keluarga (3–4 org) | 150.000 | 1 Ekor Ayam Bakar/Goreng + 4 Nasi + 4 Teh Tawar |
| Paket A (1 org) | 50.000 | Paha/Dada Ayam + Tahu Tempe + Sayur Asem + Nasi + Minuman (Teh/Air) |
| Paket B (1 org) | 40.000 | Paha/Dada Ayam + Tahu Tempe + Nasi |
| Paket C (1 org) | 40.000 | Pilihan Rawon/Gulai/Garang Asem/Bakwan/Semur + Nasi + Minuman |
| Paket D (1 org) | 40.000 | Empal Penyet + Nasi + Minuman |

---

## Catatan Operasional

**Item slash di menu cetak dipecah jadi SKU terpisah di POS.** Contoh:
`Paha Ayam Bakar/Goreng 30K` di menu cetak menjadi dua entri di sistem -
`Paha Ayam Bakar` dan `Paha Ayam Goreng` - supaya stok tiap variant
tercatat sendiri-sendiri dan dapur tidak perlu konfirmasi ulang.

**Foto menu.** Sumber foto JPEG di
[`docs/gambar makanan/`](./gambar%20makanan/) dioptimasi ke WebP 600 px
(quality 75) ke [`frontend/public/menu/`](../frontend/public/menu/) via
`npm run menu:optimize-images` di folder `backend/`. Hasil rata-rata
~20 KB per foto (dari ~100 KB sumber), totalnya ~190 KB untuk 9 foto.
Service worker PWA otomatis cache foto setelah kunjungan pertama,
sehingga kunjungan berikutnya tampil instan tanpa hit jaringan
(stale-while-revalidate, cache 30 hari).
