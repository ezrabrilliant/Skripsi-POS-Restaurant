// REV 2.12: hitung PB1 (pajak restoran 10%) dengan model 2-sumbu.
// Dipisah jadi fungsi murni supaya bisa di-unit-test tanpa DB (lihat pb1.test.ts).
//
//  - taxEnabled: apakah PB1 dihitung sama sekali.
//  - taxChargedToCustomer:
//      true  → PB1 ditambahkan ke tagihan pelanggan (taxAmount, bagian dari total).
//      false → PB1 ditanggung resto (taxBorneAmount, TIDAK masuk total; dikurangkan
//              ke laba di dashboard). Ini kondisi resto Monosuko saat ini.
//
// Matriks (base = subtotal − diskon, rate = 10%):
//   enabled=false               → tax=0,   borne=0,   total=base
//   enabled=true, charged=true  → tax=pb1, borne=0,   total=base+pb1
//   enabled=true, charged=false → tax=0,   borne=pb1, total=base

import { Prisma } from '@prisma/client';

export interface Pb1Settings {
  taxEnabled: boolean;
  /** tarif persen, mis. 10 untuk 10%. Decimal atau number. */
  taxRate: Prisma.Decimal | number;
  taxChargedToCustomer: boolean;
}

export interface Pb1Result {
  /** PB1 yang ditagih ke pelanggan (bagian dari total). */
  taxAmount: Prisma.Decimal;
  /** PB1 yang ditanggung resto (tidak di total; dikurangkan ke laba). */
  taxBorneAmount: Prisma.Decimal;
  /** Total yang dibayar pelanggan. */
  total: Prisma.Decimal;
}

/**
 * Hitung komponen PB1 dari `base` (subtotal − diskon) sesuai pengaturan AppSetting.
 * Pembulatan 2 desimal (sen) konsisten dengan kolom Decimal(12,2).
 */
export function computePb1(base: Prisma.Decimal, s: Pb1Settings): Pb1Result {
  const ratePct = s.taxEnabled ? new Prisma.Decimal(s.taxRate) : new Prisma.Decimal(0);
  const pb1 = base.mul(ratePct).div(100).toDecimalPlaces(2);
  const zero = new Prisma.Decimal(0);
  if (s.taxChargedToCustomer) {
    return { taxAmount: pb1, taxBorneAmount: zero, total: base.add(pb1) };
  }
  return { taxAmount: zero, taxBorneAmount: pb1, total: base };
}
