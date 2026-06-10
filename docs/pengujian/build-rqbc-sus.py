# -*- coding: utf-8 -*-
# Hitung model waktu RQ-B (rekonsiliasi) & RQ-C (cek/opname stok) + skor SUS 6 responden.
# Gaya & rumus efisiensi konsisten dgn RQ-A. Angka = MODEL berlabel (kecuali komposisi nyata).
# Jalankan: python docs/pengujian/build-rqbc-sus.py
def fnum(x): return f'{x:.1f}'.replace('.', ',')
def efis(b, s): return (b - s) / b * 100

print('=== RQ-C: Waktu Pengecekan Ketersediaan Stok (per jumlah item) ===')
# Manual: cek fisik/ingat ke tempat stok. Sistem: buka app + lihat angka stok real-time.
# Param (model): manual = 6 + 13*N ; sistem = 4 + 5*N
for N in (1, 3, 5):
    m = 6 + 13*N
    s = 4 + 5*N
    print(f'  {N} item: manual={fnum(m)}s  sistem={fnum(s)}s  efisiensi={fnum(efis(m,s))}%')
avg_c = sum(efis(6+13*N, 4+5*N) for N in (1,3,5))/3
print(f'  Rata-rata efisiensi = {fnum(avg_c)}%')

print('\n=== RQ-C: Waktu Opname/Pencatatan Stok (per item) ===')
# Manual: hitung fisik + tulis di buku (TANPA selisih). Sistem: hitung fisik + input + selisih OTOMATIS.
# Param: manual = 12/item (hitung+tulis) ; sistem = 13/item (hitung+input) -> ~setara waktu,
#        keunggulan sistem = selisih otomatis (akurasi), bukan kecepatan.
mo, so = 12, 13
print(f'  per item: manual={mo}s  sistem={so}s  -> WAKTU ~setara; keunggulan sistem = angka selisih otomatis (akurasi), bukan kecepatan.')

print('\n=== RQ-B: Waktu Rekonsiliasi Akhir Hari (per jumlah transaksi/hari) ===')
# Manual: pisah+jumlah per metode dari buku campur (N*6) + hitung fisik & cocok struk (75) + tulis rekap (15).
# Sistem: total per metode+bank OTOMATIS; buka settlement (5) + blind count fisik+input (75).
# (hitung fisik uang ada di KEDUA metode; yang dihapus sistem = penyortiran+penjumlahan manual N*6 + tulis 15)
for N in (5, 10, 20):
    m = N*6 + 75 + 15
    s = 5 + 75
    print(f'  {N} transaksi: manual={fnum(m)}s  sistem={fnum(s)}s  efisiensi={fnum(efis(m,s))}%')
avg_b = sum(efis(N*6+90, 80) for N in (5,10,20))/3
print(f'  Rata-rata efisiensi = {fnum(avg_b)}%  (sistem ~konstan; makin banyak transaksi, makin hemat)')

print('\n=== SUS: 6 responden (jawaban ilustratif, berlabel) ===')
# Item ganjil (1,3,5,7,9) positif: kontribusi = jawaban-1. Item genap (2,4,6,8,10) negatif: 5-jawaban.
resp = [
 ('R1','Pemilik',   [5,2,5,1,5,2,5,1,4,2]),
 ('R2','Kasir',     [5,2,4,2,5,2,4,1,4,2]),
 ('R3','Kasir',     [4,2,5,2,4,1,5,2,4,3]),
 ('R4','Kasir',     [5,1,4,2,4,2,4,2,3,2]),
 ('R5','Waiter',    [4,2,4,2,4,2,5,2,4,3]),
 ('R6','Waiter',    [5,2,4,2,4,2,4,2,4,2]),
]
def sus_score(ans):
    tot = 0
    for i,a in enumerate(ans, start=1):
        tot += (a-1) if i % 2 == 1 else (5-a)
    return tot, tot*2.5
total_scores = []
for rid, role, ans in resp:
    raw, score = sus_score(ans)
    total_scores.append(score)
    assert score <= 100, f'{rid} score>100!'
    print(f'  {rid} {role:7} P={ans}  jumlah={raw}  skor={fnum(score)}')
avg_sus = sum(total_scores)/len(total_scores)
print(f'  RATA-RATA SUS = {fnum(avg_sus)}  (acuan: >70 Acceptable; >=80,3 grade A; literatur POS 78-87)')
