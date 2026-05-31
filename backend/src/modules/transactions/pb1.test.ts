import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { computePb1 } from './pb1';

const D = (n: number | string) => new Prisma.Decimal(n);

describe('computePb1 (REV 2.12 PB1 2-sumbu)', () => {
  it('PB1 nonaktif → tidak ada pajak, total = base', () => {
    const r = computePb1(D(100000), { taxEnabled: false, taxRate: 10, taxChargedToCustomer: false });
    expect(r.taxAmount.toNumber()).toBe(0);
    expect(r.taxBorneAmount.toNumber()).toBe(0);
    expect(r.total.toNumber()).toBe(100000);
  });

  it('PB1 aktif + dibebankan ke pelanggan → tax masuk total', () => {
    const r = computePb1(D(100000), { taxEnabled: true, taxRate: 10, taxChargedToCustomer: true });
    expect(r.taxAmount.toNumber()).toBe(10000);
    expect(r.taxBorneAmount.toNumber()).toBe(0);
    expect(r.total.toNumber()).toBe(110000);
  });

  it('PB1 aktif + ditanggung resto → borne, total = base (kondisi Monosuko)', () => {
    const r = computePb1(D(100000), { taxEnabled: true, taxRate: 10, taxChargedToCustomer: false });
    expect(r.taxAmount.toNumber()).toBe(0);
    expect(r.taxBorneAmount.toNumber()).toBe(10000);
    expect(r.total.toNumber()).toBe(100000);
  });

  it('pembulatan 2 desimal (base ganjil)', () => {
    // 33333 × 10% = 3333.3
    const r = computePb1(D(33333), { taxEnabled: true, taxRate: 10, taxChargedToCustomer: true });
    expect(r.taxAmount.toNumber()).toBe(3333.3);
    expect(r.total.toNumber()).toBe(36666.3);
  });

  it('nonaktif mengabaikan flag charged', () => {
    const r = computePb1(D(50000), { taxEnabled: false, taxRate: 10, taxChargedToCustomer: true });
    expect(r.taxAmount.toNumber()).toBe(0);
    expect(r.taxBorneAmount.toNumber()).toBe(0);
    expect(r.total.toNumber()).toBe(50000);
  });

  it('tarif kustom (5%) + dibebankan', () => {
    const r = computePb1(D(200000), { taxEnabled: true, taxRate: 5, taxChargedToCustomer: true });
    expect(r.taxAmount.toNumber()).toBe(10000);
    expect(r.total.toNumber()).toBe(210000);
  });
});
