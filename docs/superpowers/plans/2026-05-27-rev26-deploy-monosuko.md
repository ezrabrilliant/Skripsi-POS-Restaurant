# REV 2.6 Production Deploy Plan — monosuko.my.id

**Target server**: Tencent Lighthouse `43.163.89.187` (Ubuntu 24.04.4)
**Database**: MySQL `pos_restaurant` di server (loopback 127.0.0.1:3306)
**Strategy**: 2-phase deploy — backfill data DULU sebelum drop kolom legacy. Zero data loss.
**Estimasi downtime**: ~5-10 menit (backend stop saat migrasi, frontend tetap serve static)

⚠️ **JANGAN execute autonomous.** User WAJIB review tiap step + run manual via SSH.

---

## Pre-flight checklist

- [ ] Code REV 2.6 sudah di-merge ke `feat/backend-express` (commit `9eff8ea`) ✅ DONE
- [ ] tsc backend + frontend clean ✅ DONE
- [ ] Local browser e2e PASS (11 scenario) — **pending user verify**
- [ ] Frontend production build OK: `cd frontend && npm run build`
- [ ] Backend production build OK: `cd backend && npm run build`
- [ ] Backup plan tested di local: `npx tsx --env-file=.env scripts/migrate-banks-from-history.ts` + `migrate-settlement-counts.ts` jalan tanpa error

---

## Phase A: Backup + intermediate schema + backfill (safe state)

### Step A.1: Backup MySQL prod (CRITICAL)

```bash
# Di server, login SSH dulu
ssh -i C:/Users/ezrak/Downloads/ezralaptop.pem ubuntu@43.163.89.187

# Di server:
mkdir -p /home/ubuntu/backups
cd /home/ubuntu/backups
BACKUP_FILE="prod-pre-rev26-$(date +%F-%H%M).sql"
mysqldump -u monosuko -pntsRIOOnkIV14BsIneXHDte0HhvC --single-transaction --routines --triggers pos_restaurant > "$BACKUP_FILE"
ls -lh "$BACKUP_FILE"
# Verify ukuran masuk akal (~1-5MB untuk skripsi data volume)

# Test integrity backup
head -20 "$BACKUP_FILE"  # cek header MySQL dump
tail -5 "$BACKUP_FILE"   # cek "Dump completed" di akhir

# Sync backup ke laptop juga (paranoid mode)
exit  # keluar SSH
scp -i C:/Users/ezrak/Downloads/ezralaptop.pem ubuntu@43.163.89.187:/home/ubuntu/backups/prod-pre-rev26-*.sql C:/Users/ezrak/Downloads/
```

**STOP point**: jangan lanjut kalau backup file size 0 atau dump terpotong. Investigate dulu.

### Step A.2: Stop backend service

```bash
# Di server via SSH
sudo systemctl stop pos-backend
sudo systemctl status pos-backend | head -5  # verify "inactive (dead)"

# Frontend nginx TETAP jalan — user yang lagi buka site akan dapat HTML tapi API call gagal
# (acceptable untuk ~5 menit window migrasi)
```

### Step A.3: Pull code baru ke server

```bash
# Di server
cd /home/ubuntu/pos-restaurant
git fetch origin
git checkout feat/backend-express
git pull origin feat/backend-express
git log --oneline -3
# Verify commit terakhir: 9eff8ea Merge branch 'feat/payment-methods-redesign'

# Install dependencies (jaga-jaga ada package baru — REV 2.6 tidak ada deps baru sih)
cd backend && npm ci
cd ../frontend && npm ci
```

### Step A.4: Apply schema INTERMEDIATE (manual SQL — bukan `prisma db push`)

**Kenapa manual SQL?** Karena schema final di-code sudah drop 12 kolom + drop enum. Kalau langsung `prisma db push`, settlement history hilang sebelum sempat di-migrate.

Run via mysql CLI atau phpMyAdmin:

```sql
USE pos_restaurant;

-- A.4.1: CREATE 4 tabel baru (sama dengan apa yang Prisma akan generate)

CREATE TABLE banks (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY banks_name_key (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_methods (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  label VARCHAR(50) NOT NULL,
  color_hex VARCHAR(7) NOT NULL,
  icon_name VARCHAR(30) NOT NULL,
  requires_bank BOOLEAN NOT NULL DEFAULT false,
  allow_dine_in BOOLEAN NOT NULL DEFAULT true,
  allow_takeaway BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY payment_methods_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_method_banks (
  payment_method_id INT NOT NULL,
  bank_id INT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (payment_method_id, bank_id),
  CONSTRAINT payment_method_banks_payment_method_id_fkey
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT payment_method_banks_bank_id_fkey
    FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE settlement_method_counts (
  settlement_id INT NOT NULL,
  payment_method_code VARCHAR(20) NOT NULL,
  counted INT NOT NULL DEFAULT 0,
  system INT NOT NULL DEFAULT 0,
  PRIMARY KEY (settlement_id, payment_method_code),
  INDEX settlement_method_counts_payment_method_code_idx (payment_method_code),
  CONSTRAINT settlement_method_counts_settlement_id_fkey
    FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT settlement_method_counts_payment_method_code_fkey
    FOREIGN KEY (payment_method_code) REFERENCES payment_methods(code) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A.4.2: ALTER transaction_payments.method dari ENUM → VARCHAR(20)
-- Data preserved otomatis (enum value 'cash' jadi string 'cash')

ALTER TABLE transaction_payments
  MODIFY COLUMN method VARCHAR(20) NOT NULL;
```

Verify:
```sql
SHOW TABLES LIKE '%payment%';
-- expected 3 row: payment_methods, payment_method_banks, transaction_payments

SHOW TABLES LIKE 'banks';
-- expected 1 row

SHOW TABLES LIKE 'settlement_method_counts';
-- expected 1 row

DESCRIBE transaction_payments;
-- verify method = varchar(20) NOT NULL (bukan enum)

SELECT COUNT(*) FROM transaction_payments WHERE method NOT IN ('cash','edc','qris','gojek','grab','transfer');
-- expected 0 — semua method value tetap valid
```

### Step A.5: Generate Prisma client di server

```bash
cd /home/ubuntu/pos-restaurant/backend
npx prisma generate
# Expected: "Generated Prisma Client" tanpa error
```

### Step A.6: Seed master data (6 method + 4 bank + 8 junction)

```bash
cd /home/ubuntu/pos-restaurant/backend
npx tsx --env-file=.env scripts/seed-payment-methods.ts
```

Expected output:
```
=== Seeding payment_methods ===
  ✓ cash (Tunai)
  ✓ edc (EDC)
  ✓ qris (QRIS)
  ✓ gojek (GoFood)
  ✓ grab (GrabFood)
  ✓ transfer (Transfer Bank)
=== Seeding banks ===
  ✓ BCA
  ✓ Mandiri
  ✓ BNI
  ✓ BRI
=== Seeding default bank assignments ===
  ✓ edc ← BCA, ... (8 total)
=== Done: 6 methods, 4 banks, 8 junctions ===
```

### Step A.7: Backfill banks dari TransactionPayment history

```bash
npx tsx --env-file=.env scripts/migrate-banks-from-history.ts
```

Expected: kalau prod ada transaksi dengan bank "Permata" / "Danamon" / bank custom lain yang dipakai sebelumnya, akan auto-create di master + junction.

```
=== Scanning distinct (method, bank) di TransactionPayment ===
Found N distinct pairs
  ✓ CREATED bank 'Permata' (kalau ada)
  ...
=== Done: X banks created, Y junctions created ===
```

### Step A.8: Backfill settlement_method_counts dari Settlement legacy 12 kolom

```bash
npx tsx --env-file=.env scripts/migrate-settlement-counts.ts
```

Expected: tiap Settlement existing → 6 child rows (cash/edc/qris/gojek/grab/transfer).

```
=== Scanning Settlement existing ===
Found N settlements
  ✓ Settlement #1: created 6 child rows
  ✓ Settlement #2: created 6 child rows
  ...
=== Done ===
Settlements: N
Expected child rows: N*6
Actual child rows: N*6
```

**CRITICAL VERIFY**: `Actual child rows == Expected child rows` (N*6). Kalau tidak, **STOP** + investigate sebelum lanjut Phase B.

### Step A.9: Sanity check coverage

```sql
-- Verify settlement_method_counts coverage
SELECT
  (SELECT COUNT(*) FROM settlements) * 6 AS expected,
  (SELECT COUNT(*) FROM settlement_method_counts) AS actual;
-- expected == actual harus TRUE

-- Verify bank master coverage (no missing dari history)
SELECT DISTINCT bank FROM transaction_payments WHERE bank IS NOT NULL
EXCEPT
SELECT name FROM banks;
-- expected 0 row (semua bank di history sudah ter-migrate)
```

### Step A.10: Restart backend + smoke test endpoint baru

```bash
sudo systemctl start pos-backend
sleep 3
sudo systemctl status pos-backend | head -5
# Expected: "active (running)"

journalctl -u pos-backend -n 30 --no-pager
# Verify "Server berjalan di port 8000" tanpa error
```

Smoke test endpoint REV 2.6:
```bash
TOKEN=$(curl -s -X POST https://monosuko.my.id/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"Owner","pin":"123456"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.token))")

# Test 1: Owner GET /payment-methods (should return 6 seeded methods)
curl -s https://monosuko.my.id/api/payment-methods \
  -H "Authorization: Bearer $TOKEN" \
  | head -c 500

# Test 2: Owner GET /banks (should return 4+ seeded banks)
curl -s https://monosuko.my.id/api/banks \
  -H "Authorization: Bearer $TOKEN" \
  | head -c 500

# Test 3: Kasir submit payment EDC with bank BCA (existing flow harus tetap jalan)
# (skip kalau tidak ada shift aktif — biar production user yang test)
```

**STOP point**: kalau backend tidak start atau endpoint REV 2.6 error, ROLLBACK (lihat bawah).

### Step A.11: Deploy frontend production build

```bash
# Di laptop (worktree utama)
cd c:/Users/ezrak/Documents/Skripsi/Skripsi-POS-Restaurant/frontend
npm run build
# Verify dist/ generated

# Tarball + upload
cd dist
tar -czf /tmp/frontend-rev26.tar.gz .
scp -i C:/Users/ezrak/Downloads/ezralaptop.pem /tmp/frontend-rev26.tar.gz ubuntu@43.163.89.187:/tmp/

# Di server: extract
ssh -i C:/Users/ezrak/Downloads/ezralaptop.pem ubuntu@43.163.89.187
cd /home/ubuntu/pos-restaurant/frontend
# Backup dist lama
mv dist dist.pre-rev26.bak
mkdir dist && cd dist
tar -xzf /tmp/frontend-rev26.tar.gz
ls -la
# Verify ada index.html, assets/, etc.
```

Frontend nginx serve static langsung — tidak perlu restart. Test browser:
```
https://monosuko.my.id → login → nav "Pembayaran" muncul → buka /payment-methods
```

---

## Phase B: Cleanup (drop legacy enum + 12 kolom)

⚠️ **HANYA jalankan kalau Phase A berhasil + Phase A.10 smoke test PASS + verify data backfill complete.**

### Step B.1: Final sanity check (sekali lagi)

```sql
SELECT COUNT(*) AS settlement_count FROM settlements;
SELECT COUNT(*) AS smc_count FROM settlement_method_counts;
-- smc_count harus >= settlement_count * 6

SELECT method, COUNT(*) FROM transaction_payments GROUP BY method;
-- Semua method values harus ada di payment_methods.code

SELECT DISTINCT method FROM transaction_payments
WHERE method NOT IN (SELECT code FROM payment_methods);
-- expected 0 row (no orphan method)
```

### Step B.2: Drop 12 kolom legacy dari settlements

```sql
ALTER TABLE settlements
  DROP COLUMN counted_cash,
  DROP COLUMN system_cash,
  DROP COLUMN counted_edc,
  DROP COLUMN system_edc,
  DROP COLUMN counted_qris,
  DROP COLUMN system_qris,
  DROP COLUMN counted_gojek,
  DROP COLUMN system_gojek,
  DROP COLUMN counted_grab,
  DROP COLUMN system_grab,
  DROP COLUMN counted_transfer,
  DROP COLUMN system_transfer;
```

**Catatan**: kolom name di prod mungkin `actual_cash` (bukan `counted_cash`) — cek `DESCRIBE settlements` dulu, adapt sesuai actual.

Verify:
```sql
DESCRIBE settlements;
-- Expected 8 kolom: id, shift_id, date, cashier_id, reviewer_id, status, submitted_at, reviewed_at
```

### Step B.3: Verify Prisma client + DB sync

```bash
cd /home/ubuntu/pos-restaurant/backend
npx prisma db push --accept-data-loss
# Expected: "Your database is now in sync with your Prisma schema" — no changes
# (kalau ada changes, berarti ada drift — investigate)
```

### Step B.4: Restart backend (jaga-jaga client cache)

```bash
sudo systemctl restart pos-backend
sleep 3
journalctl -u pos-backend -n 20 --no-pager
```

### Step B.5: Final smoke test

```bash
# Re-run smoke test endpoint REV 2.6 + flow lama
TOKEN=$(curl -s -X POST https://monosuko.my.id/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"Owner","pin":"123456"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.token))")

# Owner dashboard byMethod (now array)
curl -s "https://monosuko.my.id/api/dashboard/owner?period=today" \
  -H "Authorization: Bearer $TOKEN" \
  | head -c 800

# Verify response: revenue.byMethod is array of {paymentMethodCode, methodLabel, colorHex, total}
```

---

## Rollback Procedure (kalau ada masalah serius)

### Kalau Phase A.4 (SQL DDL) gagal di tengah

```bash
# Stop backend (kalau belum)
sudo systemctl stop pos-backend

# Restore dari backup
cd /home/ubuntu/backups
mysql -u monosuko -p pos_restaurant < prod-pre-rev26-YYYY-MM-DD-HHMM.sql
# Tunggu sampai selesai (akan drop + recreate semua tabel)

# Revert code
cd /home/ubuntu/pos-restaurant
git checkout HEAD~1  # atau commit sebelum REV 2.6
cd backend && npx prisma generate
sudo systemctl start pos-backend
```

### Kalau Phase B (drop kolom) sudah jalan tapi data corrupt

```bash
# Sayangnya kalau kolom sudah ke-drop + ada write baru, restore bisa lose data baru
# Mitigasi: dump database SEKARANG dulu (state setelah Phase B sebelum corruption noticed)
mysqldump -u monosuko -p pos_restaurant > backup-mid-rollback.sql

# Lalu restore dari pre-REV26 backup
sudo systemctl stop pos-backend
mysql -u monosuko -p pos_restaurant < /home/ubuntu/backups/prod-pre-rev26-*.sql

# Manual reconcile data antara backup lama + dump baru (kalau perlu)
```

---

## Estimasi waktu eksekusi

| Phase | Duration | Downtime backend |
|---|---|---|
| A.1 backup | 30 detik | Tidak (read-only) |
| A.2 stop service | 5 detik | Mulai |
| A.3 git pull + npm ci | 1-2 menit | Continue |
| A.4 SQL DDL | 10 detik | Continue |
| A.5-A.8 prisma + scripts | 1 menit | Continue |
| A.9 sanity | 30 detik | Continue |
| A.10 restart + smoke | 30 detik | Selesai |
| A.11 frontend deploy | 1 menit | Tidak ada (static) |
| **Phase A subtotal** | **~5 menit** | **~3 menit window** |
| B.1-B.5 cleanup | 1-2 menit | ~10 detik restart |
| **TOTAL** | **~7 menit** | **~3.5 menit** |

Best practice: lakukan **late night** (mis. 23:00+ WIB) untuk minimize impact ke user.

---

## Acceptance Criteria Production

Setelah Phase B selesai:

- [ ] `https://monosuko.my.id` HTTP 200 + bisa login Owner
- [ ] Nav "Pembayaran" muncul di sidebar Owner
- [ ] `/payment-methods` page muncul dengan 6 methods + 4+ banks
- [ ] Kasir checkout EDC + bank BCA → success (existing flow tidak rusak)
- [ ] Kasir tutup shift → settlement preview dinamis array (bukan 6 fixed bucket)
- [ ] Owner dashboard revenue chart pakai colorHex per method (`#1f7a4d`, `#2563eb`, dst)
- [ ] Historical settlement (pre-deploy) bisa di-view, methodCounts populated dari backfill
- [ ] Historical bank breakdown muncul lengkap

---

## File Reference

- Spec REV 2.6: [docs/superpowers/specs/2026-05-27-payment-methods-banks-redesign-design.md](../specs/2026-05-27-payment-methods-banks-redesign-design.md)
- Implementation plan: [docs/superpowers/plans/2026-05-27-payment-methods-banks-redesign.md](2026-05-27-payment-methods-banks-redesign.md)
- Migration scripts (kalau perlu re-run):
  - `backend/scripts/seed-payment-methods.ts`
  - `backend/scripts/migrate-banks-from-history.ts`
  - `backend/scripts/migrate-settlement-counts.ts`
- Server access pattern: memory `project_deployment_server` (SSH key + MySQL credentials)
