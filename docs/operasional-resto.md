# Operasional Resto Ayam Bakar Banjar Monosuko

> Dokumen ini adalah **ground truth** alur bisnis resto, hasil diskusi terstruktur dengan Ezra (owner / pengelola sistem). Semua keputusan teknis sistem (schema, alur kode, UI) harus mengikuti dokumen ini, bukan asumsi generik.
>
> **Versi: REV 2.3 (2026-05-24)** — penyempurnaan REV 2.2 setelah brainstorming workflow order intake. Perubahan utama: waiter primary di kertas (bukan co-equal dengan kasir untuk input order), POS access untuk waiter = fallback only. Tambah seksi baru **Permission Matrix** yang menjabarkan akses per role per aksi.
>
> Riwayat versi:
> - **REV 2.3 (2026-05-24)** — clarify waiter fallback + permission matrix lengkap (no schema change)
> - **REV 2.2 (2026-05-24)** — tambah audit log raw materials (`raw_material_movements`) + rename `stock_movements` → `portion_movements`
> - **REV 2.1 (2026-05-23)** — order type 2 enum, raw_materials fleksibel, vendor opsional, purchase_items normalized

## Gambaran Umum Operasional

Restoran X beroperasi mulai pukul 10.00 pagi dengan dua shift kerja, yaitu shift pagi yang dimulai sebelum jam 10.00 dan shift malam yang dimulai pukul 18.00. Seluruh stok makanan siap jual (stok porsi) yang ada di restoran merupakan barang setengah jadi dalam kondisi beku (frozen), yang diproduksi di rumah owner, bukan di restoran. Artinya, semua item seperti ayam, ati, rampela, gurami, udang, hingga kuah-kuahan sudah disiapkan dan dibekukan dari rumah — di restoran tinggal dibakar, digoreng, atau dipanaskan sesuai pesanan. Untuk stok porsi, tidak ada supplier luar; seluruh pasokan berasal dari produksi rumah owner sendiri. Namun untuk **bahan baku/raw materials** (beras, sayur, tahu, tempe, telur, bumbu) yang dipakai untuk masak di rumah dan kebutuhan operasional resto sehari-hari, kasir berbelanja ke pasar atau toko sehingga sistem mencatat vendor (toko/pasar tempat beli) secara opsional.

Sebelum sistem ini ada, pencatatan dilakukan secara manual menggunakan buku fisik. Buku tersebut memiliki dua sisi: sisi kiri digunakan untuk mencatat stok setiap pagi setelah restock, dan sisi kanan untuk mencatat penjualan hari itu beserta totalnya. Yang bertugas mencatat adalah kasir, yang merupakan anggota keluarga owner, dibantu oleh waiter untuk pencatatan stok di pagi dan malam hari. namun pada malam hari tidak sedetail ketika pagi, malam hanya mencatat yang kurang agar besok paginya perlu di bawa apa aja, dan itupun tidak dicatat, hanya bilang dari waiter ke kasir (anggota keluarga) agar paginya dibawakan sesuai stok yang kurang. 

Sistem ini difokuskan sebagai PWA agar bisa digunakan di perangkat mobile, karena restoran tidak memiliki komputer maupun jaringan internet sendiri. Keterbatasan koneksi internet di restoran juga menjadi salah satu pertimbangan dalam perancangan sistem.

## Alur Harian

Setiap pagi sebelum restoran buka jam 10, owner di rumah sudah tahu item apa saja yang habis dari handover kasir shift malam kemarin (lisan via telepon atau WA); kalau lupa konfirmasi, owner pakai feeling berdasarkan tren penjualan. Owner menyiapkan restock pagi-pagi, lalu kasir shift pagi (yang juga anak owner) membawa stok dari rumah ke resto.

Sesampainya di resto, kasir bersih-bersih dulu, lalu menghitung sisa stok kemarin yang masih ada di resto dan menambahkannya dengan jumlah restock pagi yang baru dibawa — hasilnya menjadi stok awal hari ini yang dicatat di sistem. Pencatatan formal stok porsi hanya dilakukan di pagi, tidak di malam.

Jika ada stok yang habis di tengah hari, kasir telpon ke rumah, lalu owner kirim stok via Gojek, Grab, atau antar sendiri. Item yang sering habis tengah hari adalah ayam bakar dan ayam goreng. Restock darurat ini dicatat saat barang sampai (via fitur Barang Masuk), bukan ditunda ke pagi berikutnya.

Untuk handover malam ke pagi, kasir shift malam (mis. Bryant) menyampaikan secara lisan ke kasir shift pagi (mis. Jason) item apa yang habis. Worst case kalau Bryant lupa, karyawan/waiter di resto yang kasih tahu Jason pagi-pagi — karena waiter setiap malam mau pulang juga ngecek-ngecek stok yang habis walau tidak mencatatnya formal (cuma diingat di kepala). Cek malam ini tujuannya bukan untuk laporan, melainkan supaya besok pagi owner tahu mau bawa restock berapa. Karena cek malam tidak ada pencatatan formal, sistem tidak menyediakan fitur "Opname Stok Porsi Malam" — yang ada cuma snapshot otomatis pagi + opname manual pagi setelah restock untuk verifikasi (sisa kemarin + restock pagi = qty fisik).

Di akhir hari, kasir shift malam melakukan rekap total penjualan sekali saja, mencakup pemasukan dari enam metode pembayaran (cash, EDC, QRIS, Gojek settlement, Grab settlement, transfer).

## Pengguna Sistem

Sistem digunakan oleh tiga jenis pengguna: kasir, waiter, dan owner. Kasir memiliki akses untuk menginput transaksi (input order, proses pembayaran), mencatat dan memperbarui stok, mencatat pembelian belanja, serta membuka dan menutup kasir per shift. Waiter memiliki tugas operasional fisik di lapangan: bersih-bersih meja dan cuci piring, mengantar makanan ke meja, membuat dan mengantar minuman, serta mengambil order dari pelanggan. **Workflow primary waiter tetap kertas** — waiter ambil order verbal di meja, tulis di kertas, lalu menyerahkan kertas ke kasir untuk diinput ke POS. Waiter juga punya akun sistem dengan akses ke fitur inventory (view stok porsi, view raw materials, opname pagi/malam, mark item habis). Sistem **memberikan waiter akses fallback** untuk input order ke POS hanya saat kasir tidak available (misal kasir sedang telepon owner, sedang ke toilet, sedang belanja ke pasar) — bukan workflow default. Realita lapangan: waiter sangat sibuk peak hour (cuci piring + buat minuman + antar makanan + ambil order baru), sehingga memutus alur kerja untuk pegang HP dan input order ke POS tidak realistis sebagai default. Owner dapat melihat laporan dari mana saja, termasuk dari rumah melalui HP atau browser. Khusus untuk input tagihan operasional, hanya owner yang memiliki akses — kasir tidak bisa melakukan ini meskipun kasir adalah anggota keluarga owner.

Pegawai riil di resto:

- **Owner** (nama di sistem cukup "Owner")
- **Kasir** (3 orang): Jason, Bryant, Chen Hong
- **Waiter** (2 orang): Amel (juga buat & antar minuman), Yanti (juga masak, tapi masak tidak ditrack di sistem)

Lisa hanya bertugas masak — tidak punya akun sistem karena masak di luar lingkup sistem.

## Permission Matrix (REV 2.3)

Tabel berikut merinci akses per role per aksi. Permission ditangani di app layer (backend middleware + frontend conditional UI), bukan di skema database.

| Resource / Aksi | Owner | Kasir | Waiter |
|---|:---:|:---:|:---:|
| Input order baru / edit / void transaksi | ✓ | ✓ | ✓ *(fallback only)* |
| Proses payment (pilih metode + bank picker EDC/transfer + PB1 + cetak struk) | ✓ | ✓ | ✗ |
| Split bill dan merge bill | ✓ | ✓ | ✗ |
| Buka kasir (input modal awal shift) | – | ✓ | ✗ |
| Tutup kasir & settlement harian (rekap 6 metode + breakdown bank) | ✓ | ✓ *(shift malam)* | ✗ |
| Mereview settlement kasir malam | ✓ | ✗ | ✗ |
| Stok porsi: view + opname pagi + mark habis + barang masuk + restock pagi | ✓ | ✓ | ✓ |
| Raw materials: view + opname malam + mark habis | ✓ | ✓ | ✓ |
| Mencatat pembelian belanja (header purchases + items + add vendor/raw_material inline) | ✓ | ✓ | ✗ |
| Bills / tagihan operasional bulanan (kebersihan, listrik, air, parkir, sewa) | ✓ | ✗ | ✗ |
| Laporan keuangan & analitik (revenue, expense, laba kotor) | ✓ *(full periode)* | ✓ *(hari ini saja, untuk verifikasi shift)* | ✗ |
| CRUD menu, paket, sub-options, harga | ✓ | ✗ | ✗ |
| CRUD user, set role, reset PIN | ✓ | ✗ | ✗ |
| Edit master raw material (rename, ubah unit, ubah is_tracked, ubah min_stock) | ✓ | ✗ | ✗ |

**Interpretasi "fallback only" untuk waiter input order:**

Backend tidak memblok hard role `waiter` dari endpoint `POST /transactions`. Endpoint tetap accept ketiga role. Yang membentuk perilaku "fallback" adalah desain UI di frontend: dashboard waiter menampilkan card besar "Stok Porsi Hari Ini" + "Raw Materials Reminder" + tombol "Opname" sebagai primary CTA, sementara akses ke "Input Order" ditaruh sebagai link kecil sekunder (bukan card besar) supaya waiter tidak terbiasa pakai sebagai default. Pada dashboard kasir, sebaliknya — "Input Order Baru" jadi primary CTA. Dengan demikian, sistem mendorong workflow kertas-mediated sebagai default, namun tidak memblok waiter kalau memang harus input (worst case kasir tidak available).

## Tipe Order

Restoran X melayani dua tipe order: **dine-in** dan **takeaway**. Dine-in artinya customer datang dan duduk di meja, sehingga sistem mewajibkan pemilihan nomor meja. Takeaway artinya pesanan tidak menempati meja — bisa walk-in (customer datang minta dibungkus), bisa order via aplikasi merchant (GoFood/GrabFood), bisa juga gosend kalau casenya dari teman owner pesan, lalu pesen untuk dikirim pakai gosend. Sistem **tidak memisahkan sub-tipe takeaway** karena identifikasi sumber order sudah cukup terlihat dari **metode pembayaran** yang dipakai (lihat seksi Pembayaran).

## Alur Transaksi

Untuk dine-in, ketika customer datang dan duduk di meja, waiter menghampiri dan mencatat pesanan di kertas. Kertas pesanan tersebut dibawa ke dapur resto (Yanti, yang panaskan/bakar/goreng makanan jadi dari frozen stock) untuk diproses, lalu diserahkan ke kasir. **Kasir** yang menginput pesanan ke sistem POS dengan memilih nomor meja yang sesuai (timing input fleksibel — antara terima kertas dari dapur dan customer minta bill, sistem tidak enforce). Jika kasir sedang tidak available (misalnya sedang telepon owner untuk koordinasi restock atau sedang ke toilet), waiter dapat input langsung sebagai fallback dengan akun POS-nya. Selama customer masih makan, mereka bisa menambah pesanan kapan saja — satu sesi meja bisa memiliki beberapa kali putaran order sebelum akhirnya minta bill. Struk dicetak dalam bentuk PDF. Jika satu meja ingin split bill, sistem memungkinkan pemisahan per item sehingga menghasilkan dua struk terpisah. Sebaliknya, sistem juga mendukung merge bill — beberapa transaksi meja yang berbeda dapat digabung menjadi satu struk, misalnya rombongan yang duduk di dua meja terpisah namun ingin bayar bareng-bareng.

Untuk takeaway, kasir menginput pesanan ke sistem POS langsung (customer walk-in datang ke kasir, atau order GoFood/GrabFood notif masuk via app merchant kasir input manual) tanpa memilih meja. Metode pembayaran dipilih sesuai sumber order (lihat seksi Pembayaran).

Restoran memiliki total 9 meja, terdiri dari 2 meja berkapasitas 6 kursi dan 7 meja berkapasitas 4 kursi.

## Pembayaran dan Rekap Akhir Hari

Sistem mendukung enam tipe metode pembayaran: **cash**, **EDC**, **QRIS**, **Gojek (settlement)**, **Grab (settlement)**, dan **transfer bank**. Pemilihan metode pembayaran sekaligus berfungsi sebagai penanda sumber order — sehingga sistem cukup punya 2 tipe order (dine-in/takeaway) tanpa perlu membedakan sub-tipe takeaway.

**EDC dan transfer bank perlu dipisah per bank** (mis. EDC BCA, EDC Mandiri, Transfer BCA, Transfer Mandiri, dll) karena owner perlu laporan per bank untuk rekonsiliasi mutasi rekening. Implementasi schema bisa pakai enum dasar (`cash`/`edc`/`qris`/`gojek`/`grab`/`transfer`) plus field `bank_name` nullable di transaksi yang terisi hanya untuk `edc` dan `transfer`. Daftar bank tidak perlu pre-defined; kasir/owner bisa tambah bank baru saat input pembayaran.

Mapping pembayaran ke sumber order:

| Tipe Order | Metode Pembayaran                                                                                                                                                                                                                  | Penjelasan                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Dine-in    | Cash / EDC (bakal dipisah bank apa, per EDC karena perlu juga laporan per banknya berapa agar lebih ter track) / QRIS / transfer bank  (bakal dipisah bank apa, karena perlu juga laporan per banknya berapa agar lebih ter track) | Customer datang dan duduk                                         |
| Takeaway   | Cash / EDC (bakal dipisah bank apa, per EDC karena perlu juga laporan per banknya berapa agar lebih ter track) / QRIS / transfer bank  (bakal dipisah bank apa, karena perlu juga laporan per banknya berapa agar lebih ter track) | Walk-in: customer datang langsung minta bungkus                   |
| Takeaway   | Gojek (settlement)                                                                                                                                                                                                                 | Order via GoFood merchant app, uang masuk lewat settlement Gojek  |
| Takeaway   | Grab (settlement)                                                                                                                                                                                                                  | Order via GrabFood merchant app, uang masuk lewat settlement Grab |


Di akhir hari, kasir shift malam melakukan rekap total sekali saja, mencakup seluruh enam metode pembayaran tersebut.

## Kategori Stok

Sistem membagi stok menjadi dua jenis: **stok porsi (portion stocks)** dan **stok bahan baku (raw materials)**. Stok porsi adalah item makanan setengah jadi siap jual yang ditrack per porsi dan berkurang otomatis setiap kali terjadi transaksi di POS. Raw materials adalah bahan baku untuk masak di rumah dan kebutuhan operasional resto (beras, sayur, tahu, tempe, telur, bumbu kering, dll) yang diperbarui manual via fitur pembelian (saat kasir belanja ke pasar) dan opname.

Untuk raw materials, sistem menyediakan dua sub-kategori berdasarkan apakah stoknya ditrack atau tidak:

- **is_tracked = true** → stok bertambah otomatis saat dicatat di pembelian; muncul di reminder kalau di bawah `min_stock`. Contoh: kangkung, tahu, tempe, beras, telur, petai.
- **is_tracked = false** → stok tidak ditrack, hanya dicatat sebagai log pengeluaran saat dibeli; tidak muncul di reminder. Contoh: cabai, bawang merah, bawang putih, kemiri, garam, daun jeruk, lengkuas, minyak goreng, dan bumbu kering lainnya.

Tambahan field `category` (enum: `bumbu_dasar` / `bahan_segar` / `bahan_pokok` / `bahan_kering` / `lainnya`) dipakai untuk grouping di laporan owner. Misalnya semua raw material `category=bumbu_dasar` (cabai, bawang, kemiri, dll) dikelompokkan menjadi 1 baris "Bumbu Dasar" di laporan pengeluaran owner.

## Stok Porsi dan Aturan Restock

Terdapat 25 item yang masuk dalam kategori stok porsi. Seluruhnya dihitung dalam satuan porsi, tidak ada breakdown lebih lanjut — satu porsi adalah satu porsi, apapun isinya. Setiap item memiliki batas minimum stok. Ketika jumlah stok menyentuh atau berada di bawah batas minimum tersebut, sistem menampilkan notifikasi atau reminder di dashboard masing-masing role sebagai pengingat untuk melakukan restock.

Restock dilakukan dalam kelipatan 5 porsi, dengan jumlah yang cukup agar stok akhir setelah restock berada di angka yang sama dengan atau di atas batas minimum. Rumusnya adalah: jumlah restock = pembulatan ke atas dari selisih antara minimum dan stok saat ini, dibagi 5, kemudian dikali 5. Sebagai contoh, jika stok paha bakar sisa 3 porsi sementara minimumnya 10, maka sistem menghitung bahwa dibutuhkan penambahan 10 porsi sehingga stok menjadi 13 porsi. Jika sisa 8, cukup ditambah 5 sehingga menjadi 13. Restock selalu dicatat di pagi hari, termasuk restock darurat yang terjadi di tengah hari sebelumnya.

Item-item dalam stok porsi mencakup: Ayam 1 Ekor Bakar, Ayam 1 Ekor Goreng, Ayam Paha Bakar, Ayam Paha Goreng, Ayam Dada Bakar, Ayam Dada Goreng, dan Kepala Ayam — masing-masing dengan batas minimum 10 porsi, kecuali Ayam 1 Ekor yang minimumnya 2 porsi. Untuk jeroan ada Ati Bakar, Ati Goreng, Rampela Bakar, dan Rampela Goreng dengan minimum 10 porsi masing-masing. Untuk seafood ada Gurami Bakar dan Gurami Goreng (minimum 2 porsi), Udang Windu Bakar dan Udang Windu Goreng (minimum 2 porsi), serta Udang Promo (minimum 3 porsi). Lauk tambahan meliputi Empal dan Bakwan dengan minimum 10 porsi. Untuk kuah-kuahan ada Garang Asem Ayam, Garang Asem Daging, Rawon Daging, Semur Daging, Gulai Daging, Gulai Babat, dan Ayam Tauco, masing-masing dengan minimum 5 porsi.

Beberapa catatan penting terkait item stok porsi: Ayam 1 Ekor memiliki stok tersendiri yang terpisah dari stok Paha dan Dada — ketika ada transaksi 1 Ekor, yang berkurang hanya stok 1 Ekor, bukan stok Paha atau Dada. Item bakar dan goreng selalu dipisah karena bumbunya berbeda: bakar cenderung manis, goreng cenderung asin. Udang Promo adalah item yang berbeda dari Udang Windu dan hanya tersedia dalam versi goreng. Setiap varian kuah-kuahan ditrack secara terpisah.

### Field tambahan portion_stocks (REV 2.1)

Tabel `portion_stocks` tidak hanya menyimpan `current_qty` saja, tapi juga:

- `opening_qty_today` — snapshot otomatis kondisi stok di awal hari (saat user pertama login pagi). Dipakai untuk metric "terjual hari ini" di dashboard.
- `min_stock` — ambang minimum (terjadi snapshot per item di kolom Menu.min_stock, tapi dipertahankan duplikatnya di sini untuk kemudahan query reminder)
- `unit` — pakai "porsi" default (tidak ada variasi unit di stok porsi karena semua dihitung per-porsi sesuai ground truth)
- Tidak menyimpan harga, karena stok porsi diproduksi dari rumah owner dan tidak ada harga pembelian per unit. Biaya pokok produksi (HPP) **di luar lingkup skripsi**.

## Relasi Menu ke Stok

Setiap item menu yang memiliki stok akan mengurangi stok yang sesuai secara otomatis saat transaksi dikonfirmasi (input pesanan ke POS). Untuk menu paket yang memberikan pilihan kepada customer, sistem harus menampilkan sub-pilihan terlebih dahulu sebelum transaksi selesai diinput. Misalnya, Paket A memberikan pilihan antara paha atau dada, dan antara bakar atau goreng — stok yang berkurang mengikuti pilihan yang dipilih customer. Paket C memberikan pilihan antara Rawon, Gulai, Garang Asem, Bakwan, atau Semur — dan hanya stok item yang dipilih yang akan berkurang.

Item-item yang tidak memiliki stok porsi tetap tersedia di menu POS untuk keperluan transaksi dan pencatatan omzet, namun tidak memengaruhi stok apapun. Item tersebut antara lain seluruh minuman, nasi, sambal, lalapan, cah kangkung, sayur asem, tahu tempe, petai, dan telur.

## Paket

Paket Keluarga seharga 150 ribu untuk 3-4 orang berisi 1 ekor ayam bakar atau goreng, 4 nasi putih, dan 4 teh tawar. Customer memilih bakar atau goreng.

Paket A seharga 50 ribu untuk 1 orang berisi paha atau dada ayam, nasi, tahu tempe, sayur asem, dan minuman. Customer memilih paha atau dada, bakar atau goreng, serta teh tawar atau teh manis.

Paket B seharga 40 ribu untuk 1 orang berisi paha atau dada ayam, nasi, dan tahu tempe. Customer memilih paha atau dada serta bakar atau goreng.

Paket C seharga 40 ribu untuk 1 orang berisi satu pilihan kuah (Rawon, Gulai, Garang Asem, Bakwan, atau Semur), nasi putih, dan satu pilihan minuman (Teh Tawar, Teh Manis, atau Air Mineral).

Paket D seharga 38 ribu untuk 1 orang berisi empal penyet, nasi, dan minuman (Teh Tawar, Teh Manis, atau Air Mineral).

Stok yang berkurang menyesuaikan sub-pilihan customer. Sebagai contoh, jika customer memesan Paket A dengan pilihan paha goreng, maka stok "Ayam Paha Goreng" berkurang 1, sementara teh tawar tidak berkurang karena tidak masuk stok porsi.

## Raw Materials (Stok Bahan Baku) dan Reminder

Raw materials diperbarui secara manual melalui dua cara: **fitur pencatatan pembelian** (saat kasir belanja ke pasar) dan **opname** (cek fisik untuk koreksi nilai stok yang menyimpang dari kondisi nyata).

### Field standar tiap raw material

Setiap raw material memiliki field berikut:

- **`name`** — nama bahan (mis. "Kangkung", "Beras", "Tahu", "Cabai Rawit", "Bawang Putih")
- **`unit`** — satuan ukur (mis. `ikat`, `karung`, `balok`, `butir`, `gram`, `liter`, `pcs`, `skala`). Bebas, mengikuti kebiasaan resto.
- **`category`** — pengelompokan untuk laporan: `bumbu_dasar` / `bahan_segar` / `bahan_pokok` / `bahan_kering` / `lainnya`
- **`is_tracked`** — boolean. `true` = stok di-update saat beli dan ada reminder; `false` = cuma jadi log pengeluaran tanpa monitoring stok
- **`stock_qty`** — kondisi stok saat ini (relevan hanya bila `is_tracked=true`)
- **`min_stock`** — ambang reminder restock. Bisa angka kecil seperti `1` untuk beras (skala 1-5 → reminder kalau ≤ 1) atau angka besar seperti `2` untuk tahu (balok)
- **`unit_price`** — harga per unit terakhir (untuk laporan biaya; otomatis di-update saat purchase baru)
- **`freshness_days`** *(opsional)* — untuk perishable seperti sayur dan petai. Bila diisi (mis. 10 untuk kangkung), sistem menampilkan countdown sisa hari dari `last_buy_date` di dashboard.
- **`last_buy_date`** — tanggal pembelian terakhir (auto-update dari purchase_items.date)

### Contoh raw materials (seed awal)

| name | unit | category | is_tracked | min_stock | freshness_days |
|---|---|---|---|---|---|
| Beras | skala | bahan_pokok | true | 1 | — |
| Kangkung | ikat | bahan_segar | true | 1 | 10 |
| Petai | ikat | bahan_segar | true | 1 | 10 |
| Tahu | balok | bahan_pokok | true | 2 | — |
| Tempe | balok | bahan_pokok | true | 2 | — |
| Telur | butir | bahan_pokok | true | 3 | — |
| Cabai Rawit | gram | bumbu_dasar | false | — | — |
| Bawang Merah | gram | bumbu_dasar | false | — | — |
| Bawang Putih | gram | bumbu_dasar | false | — | — |
| Kemiri | gram | bumbu_dasar | false | — | — |
| Minyak Goreng | liter | bahan_kering | false | — | — |
| Daun Jeruk | ikat | bumbu_dasar | false | — | — |
| Sereh | batang | bumbu_dasar | false | — | — |

Daftar di atas hanyalah seed awal. Saat kasir input pembelian dan menemukan bahan yang belum terdaftar (mis. "Bawang Putih" belum ada di daftar), kasir bisa **add new raw material langsung dari form purchase** tanpa keluar dari halaman pembelian.

### Reminder dashboard

Sistem menampilkan reminder di dashboard masing-masing role saat kondisi tertentu terpenuhi:

- `is_tracked=true` AND `stock_qty <= min_stock` → reminder "perlu restock"
- `is_tracked=true` AND `freshness_days` terisi AND `(today - last_buy_date) >= (freshness_days - 3)` → reminder "mendekati basi, beli baru"

Untuk beras dengan skala 1-5, `min_stock=1` artinya reminder muncul saat skala berada di angka 1 (hampir habis), dengan suggested action "restock 1 karung". Untuk kangkung, reminder muncul 3 hari sebelum batas freshness (mendekati hari ke-7) untuk persiapan belanja sayuran 2 ikat.

## Pembelian (Belanja Kasir)

Fitur pembelian dipakai ketika kasir berbelanja ke pasar atau toko (umumnya di malam hari sebelum tutup atau pagi sebelum buka). Pembelian dicatat sebagai header (`purchases`) dengan tanggal, vendor opsional, total, dan catatan. Detail per item dicatat di tabel anak (`purchase_items`) yang merujuk ke `raw_materials` dengan kuantitas, harga per unit, dan subtotal.

### Vendor (opsional)

Sistem menyediakan tabel `vendors` untuk mencatat toko atau pasar tempat belanja (mis. "Bu Sari", "Pasar Pagi Blok A", "Toko Pak Budi"). Pengisian vendor di tiap pembelian bersifat **opsional** karena di pasar kadang kasir lupa nama penjual atau tidak sempat tanya, terutama kalau penjualnya perorangan dan bukan toko tetap.

Field tabel vendor: `name`, `type` (mis. toko / pasar / individu), `phone` *(opsional)*, `note` *(opsional)*. Phone dan note dibuat opsional karena tidak semua penjual punya nomor telepon yang sempat dicatat.

### Alur form input pembelian

Saat kasir membuka form "Tambah Pembelian":

1. Pilih tanggal pembelian (default: hari ini)
2. Pilih vendor (opsional — bisa skip atau add new vendor inline)
3. Tambah baris item per item:
   - Pilih raw material dari dropdown (bisa filter by category bila banyak)
   - **Atau add new raw material inline** kalau belum ada di daftar
   - Input qty + unit_price (subtotal otomatis = qty × unit_price)
4. Untuk pembelian bumbu dasar yang banyak items, kasir bisa add baris satu per satu (cabe, bawang, kemiri, dst). Saat di-display di laporan owner, semua item dengan `category=bumbu_dasar` dikelompokkan menjadi 1 baris "Bumbu Dasar" dengan total agregat — detail per bumbu tetap bisa di-drill-down.
5. Total dihitung otomatis dari sum subtotal items
6. Submit → sistem update `raw_materials.stock_qty` untuk item dengan `is_tracked=true` (stock += qty), update `last_buy_date`, dan update `unit_price` ke harga pembelian terakhir.

Bahan mentah seperti ayam potong, ikan, atau udang yang sesekali dibeli juga dicatat di pembelian sebagai item dengan `is_tracked=false` karena di restoran yang dicatat adalah barang jadi (stok porsi), bukan bahan mentah yang masih perlu diolah di rumah.

## Opname Stok (Cek Fisik untuk Koreksi)

Opname adalah aktivitas cek fisik stok untuk memastikan jumlah di sistem sesuai dengan jumlah nyata. Analoginya seperti rekonsiliasi uang cash di akhir shift: meski sistem sudah mencatat semua transaksi, tetap perlu hitung uang fisik untuk verifikasi. Opname diperlukan karena ada kemungkinan stok bocor (tumpah, busuk, salah catat, atau hilang) yang tidak ter-record di transaksi normal.

### Opname stok porsi

Saat user pertama login pagi (sebelum jam 10), sistem **otomatis snapshot** kondisi `current_qty` saat ini ke kolom `opening_qty_today` di tabel `portion_stocks`. Snapshot ini dipakai untuk metric "terjual hari ini = opening_qty_today + restock_pagi_hari_ini − current_qty" yang ditampilkan di dashboard.

Setelah auto-snapshot, waiter atau kasir tetap bisa melakukan **opname manual** via halaman Stok Porsi dengan tombol "Cek Fisik & Koreksi". Saat di-klik, sistem menampilkan list 25 item dengan current_qty saat ini sebagai default. User input kondisi fisik aktual, dan sistem akan:

1. Hitung selisih per item (qty_fisik − current_qty)
2. Update current_qty ke qty_fisik
3. Catat ke `portion_movements` (rename dari `stock_movements` di REV 2.2) dengan reason `manual_adjust` dan note "Opname pagi: selisih -2" atau "Opname pagi: selisih +1"

Opname manual stok porsi paling pas dilakukan saat pagi setelah restock pagi dicatat (verifikasi total stok = sisa kemarin + restock pagi + selisih opname).

### Opname raw materials

Sama prinsipnya dengan stok porsi. Waiter di malam hari sebelum tutup membuka halaman Raw Materials, lalu untuk tiap item `is_tracked=true` user cek fisik dan masukkan koreksi kalau perlu. Untuk perishable seperti sayur, waiter juga update `last_buy_date` kalau pembelian terakhir tidak ter-record (mis. sayur dibeli tapi kasir lupa input ke pembelian).

## Stok Habis di Tengah Hari — Workflow Lengkap

Bagaimana sistem menangani stok porsi habis di tengah hari:

1. Customer order ayam goreng. Stok ayam goreng saat ini = 0
2. Kasir input order ke POS → sistem decrement `current_qty` jadi -1, catat `portion_movements` reason=`order`, note "transactionId=123"
3. Kasir menelepon owner di rumah: "Bu, ayam goreng habis, kirim ya"
4. Owner menyiapkan stok dan kirim (sendiri / Gojek / Grab) — di luar sistem
5. Barang sampai di resto
6. Kasir atau waiter buka halaman Stok Porsi → klik "Barang Masuk" untuk item Ayam Goreng → input qty datang (mis. 5)
7. Sistem update current_qty: -1 + 5 = 4; catat `portion_movements` reason=`restock_emergency`, note "Antar via Gojek 18:30, ayam goreng 5"

Pencatatan ini bersifat reactive (saat barang datang). Tidak ada konsep "stok pending" atau "order ke rumah" yang masuk sistem — komunikasi tetap via telepon manual. Sistem hanya mencatat saat fisik datang.

## Pencatatan Tagihan Operasional

Sistem juga menyediakan fitur input tagihan operasional seperti iuran kebersihan, listrik, air, parkir, dan sewa tempat. Fitur ini hanya dapat diakses oleh owner — kasir tidak memiliki akses ke bagian ini meskipun kasir adalah anggota keluarga owner. Owner yang bertanggung jawab untuk memberikan akun dan kata sandi kepada anggota keluarga yang bertugas sebagai kasir, dengan batasan hak akses yang sudah ditentukan.

## HPP dan Laba Rugi (Out of Scope)

Perhitungan HPP per porsi memerlukan data konsumsi bahan baku yang terukur dan tercatat secara akurat untuk setiap siklus produksi. Namun, pada restoran kecil berbasis keluarga seperti objek penelitian ini, proses memasak dilakukan secara batch tanpa penimbangan bahan yang baku, dan komposisi peracikan bumbu bersifat tidak tetap serta tidak terdokumentasi. Hal ini menyebabkan data input yang dibutuhkan untuk menghitung HPP tidak tersedia secara konsisten, sehingga hasil perhitungan yang dihasilkan berpotensi tidak akurat dan menyesatkan. Oleh karena itu, fitur pencatatan HPP tidak dimasukkan ke dalam ruang lingkup sistem ini, agar sistem tetap relevan, mudah digunakan, dan sesuai dengan kapasitas operasional pengguna sasaran.

Pelacakan laba rugi pada sistem ini dilakukan melalui pencatatan total pendapatan harian yang diperoleh dari rekapitulasi transaksi, serta pencatatan pengeluaran operasional secara agregat per periode. Pendekatan ini dipilih karena sesuai dengan karakteristik restoran kecil yang tidak melakukan standard costing, namun tetap membutuhkan gambaran arus kas dan profitabilitas secara periodik.

Implikasi terhadap desain sistem:
- Tidak ada relasi otomatis "raw_material → portion_stock" (tidak ada Bill of Materials / resep yang men-decrement bahan mentah saat order masuk).
- Stok porsi dan raw materials di-track sebagai dua sumbu yang terpisah: stok porsi berkurang otomatis saat order, raw materials di-update via pembelian dan opname manual.
- Laporan owner menampilkan: Pendapatan total per periode (dari transaksi), Pengeluaran total per periode (dari purchases + bills), Laba Kotor = Pendapatan − Pengeluaran. Tidak ada breakdown HPP per menu maupun margin per porsi.

## Kebijakan Lainnya

- **Login**: pegawai mengisi nama pengguna dan PIN 6 digit pada form login, lalu menekan tombol kirim. Sistem memvalidasi nama dan PIN; jika benar, langsung diarahkan ke dashboard sesuai peran (kasir / waiter / owner). Jika salah, ditampilkan pesan kesalahan dan pegawai mengulang pengisian. PIN boleh duplikat antar pegawai karena identifikasi dilakukan via nama (PIN cuma password). **Tidak ada layar pilih nama dari daftar** — semua pegawai mengetik nama mereka manual.
- **Modal awal kasir** tetap di-track di awal setiap shift (pagi dan malam) untuk perhitungan akhir hari.
- **Pembatalan (void) pesanan** boleh dilakukan kasir sendiri tanpa perlu approval atau PIN owner.
- **Diskon manual** tersedia — owner atau kasir bisa memberikan diskon (misalnya untuk pelanggan langganan).
- **Pajak PB1 10%** wajib dikenakan saat pelanggan melakukan pembayaran.
- **Cetak struk pembayaran (kuitansi total)** dalam format PDF yang di-save ke device kasir. Di masa depan, resto berencana membeli printer thermal Bluetooth sehingga sistem perlu didesain dengan abstraksi yang memungkinkan integrasi printer.
- **Tidak ada cetak struk pesanan untuk dapur.** Waiter mencatat pesanan di kertas dan menyampaikan ke kasir (yang lalu input ke POS) — komunikasi ke dapur bersifat verbal/kertas karena dapur produksi berada di rumah owner, bukan di resto, sehingga tidak praktis untuk dialiri struk digital.
- **Reminder stok** ditampilkan di dashboard masing-masing role saat login — kasir dan waiter melihat list item yang perlu di-restock di halaman utama mereka.
