// REV 2.6: Seed master payment methods + banks + default junctions.
// Idempotent: re-run aman (upsert by code/name).
//
// Exportable as `seedPaymentMethods(prisma)` untuk dipanggil dari prisma/seed.ts.
// Juga bisa dijalankan standalone via:
//   npx tsx --env-file=.env scripts/seed-payment-methods.ts

import { PrismaClient } from '@prisma/client';

interface MethodSeed {
  code: string;
  label: string;
  colorHex: string;
  iconName: string;
  requiresBank: boolean;
  allowDineIn: boolean;
  allowTakeaway: boolean;
  displayOrder: number;
}

const METHODS: MethodSeed[] = [
  { code: 'cash',     label: 'Tunai',         colorHex: '#1f7a4d', iconName: 'Banknote',       requiresBank: false, allowDineIn: true,  allowTakeaway: true,  displayOrder: 1 },
  { code: 'edc',      label: 'EDC',           colorHex: '#2563eb', iconName: 'CreditCard',     requiresBank: true,  allowDineIn: true,  allowTakeaway: true,  displayOrder: 2 },
  { code: 'qris',     label: 'QRIS',          colorHex: '#9333ea', iconName: 'QrCode',         requiresBank: false, allowDineIn: true,  allowTakeaway: true,  displayOrder: 3 },
  { code: 'gojek',    label: 'GoFood',        colorHex: '#16a34a', iconName: 'Bike',           requiresBank: false, allowDineIn: false, allowTakeaway: true,  displayOrder: 4 },
  { code: 'grab',     label: 'GrabFood',      colorHex: '#dc2626', iconName: 'Truck',          requiresBank: false, allowDineIn: false, allowTakeaway: true,  displayOrder: 5 },
  { code: 'transfer', label: 'Transfer Bank', colorHex: '#d97706', iconName: 'ArrowLeftRight', requiresBank: true,  allowDineIn: true,  allowTakeaway: true,  displayOrder: 6 },
];

const BANKS = ['BCA', 'Mandiri', 'BNI', 'BRI'];

const DEFAULT_BANK_ASSIGNMENT: Record<string, string[]> = {
  edc:      ['BCA', 'Mandiri', 'BNI', 'BRI'],
  transfer: ['BCA', 'Mandiri', 'BNI', 'BRI'],
};

export async function seedPaymentMethods(prisma: PrismaClient) {
  console.log('=== Seeding payment_methods ===');
  for (const m of METHODS) {
    const created = await prisma.paymentMethod.upsert({
      where: { code: m.code },
      update: {
        label: m.label,
        colorHex: m.colorHex,
        iconName: m.iconName,
        requiresBank: m.requiresBank,
        allowDineIn: m.allowDineIn,
        allowTakeaway: m.allowTakeaway,
        displayOrder: m.displayOrder,
      },
      create: m,
    });
    console.log(`  ✓ ${created.code} (${created.label})`);
  }

  console.log('\n=== Seeding banks ===');
  for (const name of BANKS) {
    const created = await prisma.bank.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  ✓ ${created.name}`);
  }

  console.log('\n=== Seeding default bank assignments ===');
  for (const [methodCode, bankNames] of Object.entries(DEFAULT_BANK_ASSIGNMENT)) {
    const method = await prisma.paymentMethod.findUniqueOrThrow({ where: { code: methodCode } });
    for (const bankName of bankNames) {
      const bank = await prisma.bank.findUniqueOrThrow({ where: { name: bankName } });
      await prisma.paymentMethodBank.upsert({
        where: { paymentMethodId_bankId: { paymentMethodId: method.id, bankId: bank.id } },
        update: {},
        create: { paymentMethodId: method.id, bankId: bank.id },
      });
      console.log(`  ✓ ${methodCode} ← ${bankName}`);
    }
  }

  const stats = await Promise.all([
    prisma.paymentMethod.count(),
    prisma.bank.count(),
    prisma.paymentMethodBank.count(),
  ]);
  console.log(`\n=== Done: ${stats[0]} methods, ${stats[1]} banks, ${stats[2]} junctions ===`);
}

// Allow standalone run via: npx tsx --env-file=.env scripts/seed-payment-methods.ts
// `require.main === module` check supaya import dari seed.ts tidak auto-execute.
if (require.main === module) {
  const prisma = new PrismaClient();
  seedPaymentMethods(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
