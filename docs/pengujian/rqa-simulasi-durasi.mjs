// =============================================================================
// RQ-A — Simulasi durasi transaksi (sebelum manual vs sesudah POS)  [REVISI 2]
// Skripsi POS Restoran Ayam Bakar Banjar Monosuko (C14220315)
//
// PRINSIP (hasil diskusi koreksi Ezra 2026-06-03):
//   - INPUT pesanan (tulis vs tap)  -> ~SAMA; POS sedikit lebih lambat (navigasi/learning).
//   - BAYAR non-tunai (qris/edc/tf) -> ~SAMA (tanpa payment gateway; input metode setara).
//   - BAYAR tunai                    -> POS lebih cepat (ASUMSI fitur input-uang + rekomendasi
//                                       kembalian/denominasi sudah ada; tak perlu hitung manual).
//   - HITUNG harga/total (kasir)     -> POS = 0 (auto-sum); manual = baris*7s + finalisasi.  <- INTI HEMAT
//   - SPLIT-tender                   -> manual: kalkulator hitung sisa + catat ganda; POS: sisa auto.
//   - MERGE meja                     -> manual: jumlahkan total antar-meja (kalkulator) + tandai gabung;
//                                       POS: pencet merge, pilih meja, total auto.
//
// SUMBER ANGKA:
//   - Komposisi 28 tx 21-27 Mei = NYATA (docs/data buku/). (Semua single-meja, single-metode:
//     order-set riil TIDAK memuat split/merge -> keduanya disajikan sbg SKENARIO KAPABILITAS terpisah.)
//   - Latensi sistem = DIUKUR ke monosuko.my.id (~0,14 s/round-trip tulis).
//   - Parameter interaksi manusia = MODEL berbasis literatur (akan dikalibrasi sampel stopwatch riil):
//       ketik mobile ~36 WPM (Palin dkk. 2019, Aalto 37k-study); tulis tangan ~13-25 WPM;
//       hukum Fitts (tap layar sentuh); aritmetika manual ritel 3-7 s/baris.
//
// Deterministik (tanpa jitter) -> reproducible.   Jalankan: node docs/pengujian/rqa-simulasi-durasi.mjs
// =============================================================================

// ---- INPUT (≈ setara; POS rugi tipis) ----
const WRITE_LINE  = 5;   // s/baris  — manual tulis tangan 1 baris
const TAP_LINE    = 6;   // s/baris  — POS cari+tap+qty (sedikit lebih lambat: navigasi/learning)
const PAKET_WRITE = 3;   // s/paket  — manual tulis sub-pilihan paket
const PAKET_MODAL = 6;   // s/paket  — POS modal sub-pilihan paket

// ---- Handoff & meja ----
const HANDOFF     = 2;   // s/meja   — manual antar kertas waiter->kasir (POS: input langsung = 0)
const TABLE_NOTE  = 2;   // s/meja   — manual catat no meja (dineIn)
const TABLE_SELECT= 4;   // s/meja   — POS pilih meja (dineIn)

// ---- HITUNG (manual; POS = 0)  <- sumber utama hemat ----
const CALC_LINE   = 7;   // s/baris  — manual lookup harga + tambah ke total
const CALC_FINAL  = 4;   // s/tx     — manual finalisasi/tulis total (jika baris>1)
const MERGE_CALC  = 6;   // s/meja-tambahan — manual jumlahkan total antar-meja (kalkulator)
const MERGE_MARK  = 4;   // s/tx     — manual tandai "gabung" di buku

// ---- BAYAR (per metode) ----
const PAY_MANUAL = { cash:20, qris:12, edc:16, transfer:14 }; // s — fisik + catat manual (tunai: hitung+kembalian manual)
const PAY_POS    = { cash:10, qris:12, edc:16, transfer:14 }; // s — non-tunai SETARA; tunai POS lbh cepat (auto-kembalian)

// ---- SPLIT-tender ----
const SPLIT_CALC  = 10;  // s/tx     — manual: kalkulator hitung sisa tagihan
const SPLIT_REC   = 4;   // s/slice-tambahan — manual: catat baris pembayaran tambahan
const TOGGLE_POS  = 2;   // s/tx     — POS toggle "Bayar Sebagian"
const SPLIT_POS   = 5;   // s/slice-tambahan — POS input slice (sisa auto-hitung)

// ---- MERGE interaksi POS ----
const MERGE_POS   = 6;   // s/meja-tambahan — POS pencet merge + pilih meja (total auto)

// ---- Misc & latensi ----
const SUBMIT_POS  = 2;   // s/meja — POS submit pesanan
const PDF_POS     = 0;   // s/tx   — POS save struk PDF DIKECUALIKAN dari waktu (nilai-tambah, manual tak punya; dicatat terpisah ~2s)
const SRV_RTT     = 0.14;               // s/round-trip — DIUKUR ke prod (operasi tulis)
const MOBILE      = { '4G':0.07, '3G':0.25 }; // s/round-trip — overhead akses seluler (model)
const BASE_CALLS  = 3;                  // create order + payment + refresh

// ---- Order-set riil 21-27 Mei (28 tx; semua single-meja, single-metode) ----
const TX = [
  {d:'21',n:1,lines:1,units:3,paket:0,pay:'transfer'}, {d:'21',n:2,lines:4,units:6,paket:0,pay:'qris'},
  {d:'21',n:3,lines:1,units:1,paket:0,pay:'cash'},     {d:'21',n:4,lines:4,units:5,paket:3,pay:'cash'},
  {d:'21',n:5,lines:4,units:6,paket:0,pay:'qris'},
  {d:'22',n:1,lines:2,units:6,paket:1,pay:'qris'},     {d:'22',n:2,lines:2,units:2,paket:2,pay:'qris'},
  {d:'22',n:3,lines:1,units:1,paket:0,pay:'edc'},      {d:'22',n:4,lines:6,units:7,paket:0,pay:'qris'},
  {d:'23',n:1,lines:1,units:1,paket:0,pay:'qris'},     {d:'23',n:2,lines:4,units:6,paket:1,pay:'qris'},
  {d:'23',n:3,lines:3,units:3,paket:2,pay:'qris'},     {d:'23',n:4,lines:8,units:11,paket:0,pay:'qris'},
  {d:'23',n:5,lines:4,units:5,paket:1,pay:'qris'},     {d:'23',n:6,lines:4,units:6,paket:0,pay:'qris'},
  {d:'23',n:7,lines:10,units:14,paket:0,pay:'qris'},
  {d:'24',n:1,lines:6,units:9,paket:0,pay:'cash'},     {d:'24',n:2,lines:1,units:1,paket:0,pay:'edc'},
  {d:'24',n:3,lines:1,units:1,paket:1,pay:'qris'},
  {d:'25',n:1,lines:1,units:1,paket:0,pay:'qris'},     {d:'25',n:2,lines:6,units:7,paket:0,pay:'qris'},
  {d:'25',n:3,lines:1,units:3,paket:1,pay:'edc'},      {d:'25',n:4,lines:3,units:3,paket:0,pay:'qris'},
  {d:'26',n:1,lines:2,units:3,paket:1,pay:'qris'},     {d:'26',n:2,lines:2,units:2,paket:0,pay:'qris'},
  {d:'26',n:3,lines:1,units:10,paket:1,pay:'transfer'},{d:'26',n:4,lines:1,units:1,paket:0,pay:'cash'},
  {d:'27',n:1,lines:2,units:2,paket:0,pay:'transfer'},
].map(t => ({ ...t, tables:1, slices:1, methods:[t.pay], ch:'dine' }));

function before(t){
  const tables=t.tables, slices=t.slices, methods=t.methods;
  let s = t.lines*WRITE_LINE + t.paket*PAKET_WRITE;        // input
  s += HANDOFF*tables;                                      // antar kertas / meja
  if(t.ch==='dine') s += TABLE_NOTE*tables;                 // catat no meja
  s += t.lines*CALC_LINE + (t.lines>1?CALC_FINAL:0);        // hitung item
  if(tables>1) s += MERGE_CALC*(tables-1) + MERGE_MARK;     // gabung meja: jumlah + tandai
  for(const m of methods) s += PAY_MANUAL[m];               // tiap metode: fisik+catat
  if(slices>1) s += SPLIT_CALC + SPLIT_REC*(slices-1);      // split: hitung sisa + catat ganda
  return s;
}
// NOVICE_FACTOR: pengali waktu operasi UI POS saat user MASIH AWAM (belum terbiasa).
// Manual TIDAK diberi faktor ini (staff sudah mahir bertahun-tahun = proses lama/incumbent).
// Asumsi netral: bandingkan "manual-mahir" vs "POS-mahir" DAN vs "POS-awam".
const NOVICE = 1.5;

function after(t, net, f){   // f = faktor UI (1 = mahir, NOVICE = awam)
  const tables=t.tables, slices=t.slices, methods=t.methods;
  let ui = t.lines*TAP_LINE + t.paket*PAKET_MODAL;         // input
  if(t.ch==='dine') ui += TABLE_SELECT*tables;             // pilih meja
  ui += SUBMIT_POS*tables;                                 // submit pesanan
  if(tables>1) ui += MERGE_POS*(tables-1);                 // interaksi merge (total auto)
  if(slices>1) ui += TOGGLE_POS + SPLIT_POS*(slices-1);    // toggle + input slice (sisa auto)
  ui *= f;                                                 // penalti UI saat awam (calc tetap 0, latensi tak terpengaruh)
  const pay = PAY_POS[methods[0]];                         // metode pertama (fisik/konfirmasi, tak di-faktor)
  const calls = BASE_CALLS + (slices-1) + (tables-1);
  const lat = calls*(SRV_RTT + MOBILE[net]);
  return ui + pay + PDF_POS + lat;
}

const strata = (t)=> (t.lines<=2 && t.paket===0) ? 'S' : 'K';
const fmt = (x)=> x.toFixed(1);
const sign = (x)=> (x>0?'+':'')+x.toFixed(1);
const arah = (d)=> d > 1 ? 'POS lbh cepat' : d < -1 ? 'POS lbh lambat' : 'setara';
// NET = '4G' default (3G hanya +~0,6 s/tx; tak material). Bandingkan manual-mahir vs POS-mahir & POS-awam.
const NET = '4G';
const rows = TX.map(t=>{
  const b=before(t), posM=after(t,NET,1), posN=after(t,NET,NOVICE);
  return {...t, st:strata(t), b, posM, posN, dm:b-posM, dn:b-posN, pm:(b-posM)/b*100, pn:(b-posN)/b*100};
});
const avg=(a,f)=>a.reduce((s,x)=>s+f(x),0)/a.length;
function agg(label,set){ const b=avg(set,x=>x.b),pm=avg(set,x=>x.posM),pn=avg(set,x=>x.posN);
  return {label,c:set.length,b,pm,pn,ppm:(b-pm)/b*100,ppn:(b-pn)/b*100}; }

console.log('=== RQ-A: 28 transaksi riil 21-27 Mei (detik, jaringan 4G) ===');
console.log('Tgl No St br pkt metode   | MANUAL | POS-mahir  Δ    arah          | POS-awam  Δ    arah');
for(const r of rows) console.log(
  `${r.d} ${String(r.n).padEnd(2)} ${r.st} ${String(r.lines).padEnd(2)} ${String(r.paket).padEnd(2)} ${r.pay.padEnd(8)}| ${fmt(r.b).padStart(5)}  | ${fmt(r.posM).padStart(6)} ${sign(r.dm).padStart(6)}  ${arah(r.dm).padEnd(13)}| ${fmt(r.posN).padStart(6)} ${sign(r.dn).padStart(6)}  ${arah(r.dn)}`);
console.log('\n=== Agregat (rata-rata, detik) ===');
console.log('Kelompok    n  MANUAL  POS-mahir (Δ, %)        POS-awam (Δ, %)');
for(const g of [agg('Sederhana',rows.filter(r=>r.st==='S')), agg('Kompleks',rows.filter(r=>r.st==='K')), agg('Semua',rows)])
  console.log(`${g.label.padEnd(10)} ${String(g.c).padStart(2)} ${fmt(g.b).padStart(6)}  ${fmt(g.pm).padStart(6)} (${sign(g.b-g.pm)}, ${fmt(g.ppm)}%)   ${fmt(g.pn).padStart(6)} (${sign(g.b-g.pn)}, ${fmt(g.ppn)}%)`);

// ---- Skenario kapabilitas (DI LUAR order-set riil; ilustratif) ----
const SCEN = [
  {label:'Split-tender (1 meja, 2 metode: 50k cash + sisa qris)', lines:3, paket:1, tables:1, slices:2, methods:['cash','qris'], ch:'dine'},
  {label:'Merge 2 meja (1 metode qris)',                          lines:3, paket:2, tables:2, slices:1, methods:['qris'],         ch:'dine'},
  {label:'Merge 2 meja + split (50k cash + sisa qris)',           lines:3, paket:2, tables:2, slices:2, methods:['cash','qris'], ch:'dine'},
];
console.log('\n=== Skenario KAPABILITAS (ilustratif, di luar 28 tx riil; 4G) ===');
for(const sc of SCEN){ const b=before(sc),m=after(sc,NET,1),n=after(sc,NET,NOVICE);
  console.log(`${sc.label}\n   MANUAL=${fmt(b)}s | POS-mahir=${fmt(m)}s (${sign(b-m)}, ${fmt((b-m)/b*100)}%) | POS-awam=${fmt(n)}s (${sign(b-n)}, ${fmt((b-n)/b*100)}%)`); }
console.log(`\n(NOVICE_FACTOR=${NOVICE} pada operasi UI POS; manual = mahir/incumbent tanpa faktor. 3G ~+0,6 s/tx, tak material.)`);
