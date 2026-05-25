---
name: use-case-diagram
description: Build UML Use Case Diagrams in StarUML for Indonesian ADSI (Analisis Design Sistem Informasi) skripsi. Use this skill whenever the user asks to create, rebuild, review, or fix a use case diagram - even when they use words like "use case", "UC diagram", "diagram aktor", or describe actors/use cases informally. Covers ADSI Modul Pembelajaran Bab 5 + real skripsi conventions from 3 POS case studies (restoran cross-channel, supermarket ABC-VED, toko inventory control). Uses staruml-mcp tools (`create_diagram UMLUseCaseDiagram`, `create_element_with_view UMLActor/UMLUseCase/UMLSubsystem`, `create_edge_with_view UMLAssociation/UMLInclude/UMLExtend/UMLGeneralization`). Do not create a use case diagram without consulting this skill first.
---

# Use Case Diagram - ADSI + skripsi-praktis convention + StarUML MCP

Sumber otoritatif:
- **ADSI Bab 5** - Modul Pembelajaran ADSI (`docs/extracted/adsi.txt` §5)
- **3 contoh skripsi POS** di `docs/pdf-pages/`: resto, super, toko

---

## 1. Struktur (ADSI §5 verbatim)

**5 elemen:**
1. **Actor** - role yang berinteraksi dengan sistem (stick figure)
2. **Use Case** - fitur/behavior yang dapat dikerjakan (oval/ellipse)
3. **Association** - connector actor ↔ use case (garis lurus, no arrow standard)
4. **System name** - label sistem
5. **System boundary** - rectangle batas sistem (**opsional** per ADSI; di skripsi praktis **sering ada**, kadang tidak - pilih sesuai kebutuhan)

---

## 2. Actor - characteristics dari ADSI §5 + skripsi

**Per ADSI:**
- Role / pekerjaan yang berinteraksi dengan sistem, **berada di luar sistem**
- Kata benda (noun): `Kasir`, `Owner`, `Admin`, `Kitchen`, `Supplier`
- Jenis actor: human, external system/device, another system, time/scheduler

**Per skripsi:**
- Actor biasanya 2-5 per diagram (jangan terlalu banyak)
- Ditempatkan di **sisi kiri & kanan** cluster use cases
- Contoh dari 3 skripsi:
  - resto: `Kasir`, `Admin` (2)
  - super: `User` (generic, kalau hanya 1 role aktif) / `Manager`, `Admin`, `Distributor` (3)
  - toko: `Kasir`, `Owner`, `Customer`, `Supplier`, `Sistem Notifikasi` (5 - 3 human + 1 external + 1 sistem notif)

**Primary vs Secondary** (ADSI):
- Primary → inisiasi use case (biasanya kiri)
- Secondary → partisipasi sebagian (biasanya kanan)

**Association rules (ADSI verbatim):**
- *"Actor harus berelasi dengan satu atau lebih use case."*
- *"Use case harus berelasi dengan satu atau lebih actor."*
- *"Tidak ada use case atau actor yang berdiri sendiri."*
- *"Tidak ada asosiasi antar actor"* - never draw a line actor ↔ actor. Gunakan inheritance (hollow triangle) jika satu aktor specialization dari yang lain.

---

## 3. Use Case naming - verb + noun

**Per ADSI §5 verbatim:**
> *"menggunakan kata kerja dan kata benda, misal mengelola data konsumen, mengelola reservasi"*

**Style dari 3 contoh skripsi:**

| Style | Contoh | Dipakai di |
|---|---|---|
| lowercase Indonesian | `mengatur menu pada sistem dan gobiz`, `melihat histori transaksi`, `me-refund pesanan`, `membuat menu promo pada Gobiz` | resto |
| Title Case English | `Make Sales`, `Add Purchase`, `Reorder Point Notification`, `ABC-VED Analysis Result` | toko |
| Title Case Indonesian | `Mengelola Menu`, `Memproses Pembayaran`, `Melakukan Opname Stok` | super + umum di skripsi Indonesian |

Pilih **1 style** dan konsisten.

**❌ Bad names (gagal review dosen):**
- Noun only: `Customer`, `Dashboard`, `Database`
- UI click: `Click Login Button`, `Tekan Tombol Bayar`
- Technical primitive: `Validate Input`, `Fetch Data`, `Store Record`
- Manual-only process (tidak melibatkan sistem) - hapus
- Super-fine-grained (field edit): `Edit Nama Customer` - gabung ke `Mengelola Customer`

**✅ Atomicity rule (CRITICAL - paling sering saya kesalahan):**

Satu UC = **satu atomic business goal**, bukan daftar sub-view/sub-laporan/sub-CRUD.

| ❌ Over-split (jangan) | ✅ Konsolidasi (pakai ini) |
|---|---|
| `Melihat Dashboard` + `Melihat Laporan Pendapatan` + `Melihat Laporan Pengeluaran` + `Melihat Laporan Laba Kotor` + `Melihat Laporan Rekonsiliasi` (5 UC) | `Melihat Dashboard dan Laporan` (1 UC) |
| `Mencatat Pengeluaran` + `Mengedit Pengeluaran` + `Menghapus Pengeluaran` | `Mengelola Pengeluaran` |
| `Tambah Menu` + `Edit Menu` + `Hapus Menu` | `Mengelola Menu` |

Detail sub-flow masuk **Use Case Scenario** (ADSI §6 narrative Beginning/Middle/End) atau **Use Case Form** (ADSI Tabel 6.2) - **bukan** di diagram.

Target count: **7-15 UC** per diagram skripsi. Lebih dari 20 biasanya over-split.

**Exception:** split valid kalau sub-operations punya genuinely different actors/triggers/pre-post. Contoh: `Memecah Tagihan` vs `Menggabungkan Tagihan` vs `Membatalkan Pesanan` - all distinct.

**Mengelola X → CRUD detail:** ADSI Gambar 5.8 tunjukkan `Mengelola X` bisa dispecialize jadi `Create`, `Update`, `Delete` kalau benar-benar diperlukan. Biasanya di skripsi cukup `Mengelola X` saja di diagram, detail CRUD di scenario.

---

## 4. System boundary - opsional tapi umum

**Per ADSI §5:** *"bersifat opsional"*

**Per 3 skripsi observed:**
- resto: **tidak ada** boundary box eksplisit - actors stick figure, UCs floating di tengah
- super: **tidak ada** boundary explicit
- toko: **ADA** - rectangle dengan label `Point of Sales dan Inventory System`

**Rekomendasi skripsi POS:** **pakai boundary** dengan label sistem (contoh `Sistem POS Restoran`) - lebih profesional dan jelas scope-nya. Tapi bukan wajib.

Aktor **di luar** boundary, use cases **di dalam**.

---

## 5. Dependencies - `<<include>>` dan `<<extend>>`

**`<<include>>` - mandatory dependency** (ADSI §5 verbatim):
> *"Use case a includes use case b, artinya setiap use case a dieksekusi maka use case b harus berjalan dulu."*

- Garis putus-putus, panah terbuka, label `<<include>>`
- **Panah ke arah UC yang jalan duluan** (yang di-include-kan)
- Contoh skripsi: `Atur Transaksi` `<<include>>` `Login` (Login jalan duluan, jadi panah ke Login)
- resto skripsi: **hampir semua main UC punya `<<include>>` ke Login** - pola sangat umum

**`<<extend>>` - optional dependency** (ADSI §5):
> *"Use case a extends use case b, artinya use case a dapat memanggil (opsional) use case b jika memenuhi kondisi tertentu."*

- Garis putus-putus, panah terbuka, label `<<extend>>`
- **Panah ke arah base UC** (yang di-extend), extending UC berjalan opsional
- Contoh: `Mencetak Struk` `<<extend>>` `Memproses Pembayaran`

**Arrow direction mnemonic** (ADSI verbatim):
> *"Anak panah menunjuk ke use case yang dijalankan terlebih dulu."*

Both include+extend: arrow → UC yang jalan pertama.

---

## 6. Actor generalization (jarang, tapi valid)

ADSI §5 Gambar 5.9: actor inheritance = actor turunan dari actor lain. Contoh: `Gold Customer` inherits dari `Standard Customer`.

Garis dengan **hollow triangle** ke parent actor.

**Kapan pakai:** kalau 2+ aktor share banyak UC, ekstrak parent abstract. Di POS skripsi biasanya tidak perlu (3-5 aktor cukup flat).

---

## 7. Layout conventions dari skripsi

**Pola yang terlihat:**
- Actors di kiri & kanan cluster UC
- UC tersebar di tengah, kadang clustered by domain:
  - resto: UC untuk order/transaction di kiri, UC untuk monitoring/menu di tengah, UC untuk refund/promo di kanan
  - toko: UC grup per-domain (sales, purchase, master data, inventory)
- `<<include>>` lines dari banyak UC konvergen ke Login - kelompokkan di tengah-bawah untuk arrow rapi
- Gunakan **spacing generous** antar UC (min 60px vertikal) supaya label `<<include>>` tidak overlap

---

## 8. Build di StarUML via staruml-mcp

### Step 1 - container + diagram
```
mcp__staruml__create_element type=UMLModel parentId=<projectId> name="Use Case Model"
mcp__staruml__create_diagram type=UMLUseCaseDiagram parentId=<modelId> name="Use Case Diagram - <Nama Sistem>"
```

### Step 2 - boundary (opsional)
```
mcp__staruml__create_element_with_view type=UMLSubsystem parentId=<modelId> diagramId=<diagId> name="Sistem POS Restoran" x=220 y=60 x2=1020 y2=900
```

### Step 3 - actors (stick figure, pakai UMLActor)
```
type=UMLActor parentId=<modelId> diagramId=<diagId> name="Kasir" x=80 y=300 x2=140 y2=400   # kiri
type=UMLActor ... name="Owner" x=1080 y=300 x2=1140 y2=400                                   # kanan
```

### Step 4 - use cases (oval, pakai UMLUseCase)
```
type=UMLUseCase parentId=<modelId> diagramId=<diagId> name="Login" x=... y=...
# ~180x50 size, consistent
```

### Step 5 - associations
```
type=UMLAssociation tailViewId=<actorView> headViewId=<ucView>
```
No name. No arrow head by default.

### Step 6 - include/extend
```
# <<include>>: tail=base UC, head=included UC (arrow ke included yang jalan duluan)
type=UMLInclude tailViewId=<baseUC> headViewId=<includedUC>

# <<extend>>: tail=extending UC, head=base UC (arrow ke base yang jalan duluan)
type=UMLExtend tailViewId=<extendingUC> headViewId=<baseUC>
```

### Step 7 - save
```
mcp__staruml__save_project filename="..."
```

---

## 9. Checklist verifikasi

1. ✅ **Actors 2-5** (terlalu banyak = diagram kusut; tapi toko bisa 5 kalau sistemnya kompleks)
2. ✅ Setiap actor **≥1 association**
3. ✅ Setiap UC **≥1 actor association**
4. ✅ Nama UC **verb + noun**, tidak ada yg cuma noun/UI click/SQL
5. ✅ Konsistensi style (all lowercase Indonesian OR all Title Case OR all English - jangan campur)
6. ✅ **Atomicity:** tidak ada cluster UC yg harusnya dikonsolidasi jadi 1 (contoh: 5 variasi Melihat Laporan)
7. ✅ **Tidak ada actor-to-actor** line (kecuali inheritance hollow triangle)
8. ✅ `<<include>>` panah ke UC yg jalan duluan
9. ✅ `<<extend>>` panah ke base UC (extending opsional)
10. ✅ Target count **7-15 UC total**
11. ✅ System boundary opsional - kalau dipakai, label sistem jelas, aktor di luar box

---

## 10. Worked example - POS Ayam Bakar Banjar Monosuko

**3 actors:** `Owner`, `Kasir`, `Kitchen` (3 role sesuai backend plan)

**~12 Use Cases:**
- Shared: `Login`
- Kasir: `Buka Kasir`, `Mengelola Pesanan Meja`, `Memecah Tagihan`, `Menggabungkan Tagihan`, `Membatalkan Pesanan`, `Memproses Pembayaran`, `Mencetak Struk`, `Melakukan Stock Opname`, `Tutup Kasir`
- Kitchen: `Menginput Stok Masuk`
- Owner: `Mengelola Menu`, `Mengelola Pengguna`, `Mengelola Pengeluaran`, `Melihat Dashboard dan Laporan`

**Dependencies:**
- `Mencetak Struk` `<<extend>>` `Memproses Pembayaran`
- (Optional) `Membatalkan Pesanan` `<<include>>` `Verify PIN Owner` - tapi biasanya PIN elevation digambarkan di scenario, bukan UC separate

Boundary: `Sistem POS Restoran` (rectangle label).

---

## 11. Common mistakes

- ❌ UC berupa cluster 5 varian "Melihat X" → konsolidasi jadi 1 `Melihat Dashboard dan Laporan`
- ❌ UC cuma noun: `Customer`, `Dashboard`, `Database` → rename verb+noun
- ❌ Actor inside boundary → move out
- ❌ Actor tidak ada association → kasih relasi atau hapus
- ❌ `<<extend>>` arrow terbalik (menunjuk extending) → flip ke base
- ❌ Language inconsistent (UC name 50/50 Indonesian/English) → pilih satu
- ❌ UC terlalu teknis / UI-level (`Click Submit Button`) → rename business
- ❌ >20 UC → hampir pasti over-split; konsolidasi
