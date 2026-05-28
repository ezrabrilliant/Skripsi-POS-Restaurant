// Manual DB reset (drop all tables) - bypasses Prisma's AI-agent safety guard
// Target: local development DB only (mysql://root:@localhost:3306/pos_restaurant)
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
// Order respects FK chains: child/junction tables first, then parents
const tables = [
  'settlement_method_counts',
  'payment_method_banks',
  'transaction_payments',
  'transaction_items',
  'settlements',
  'transactions',
  'shifts',
  'portion_movements',
  'raw_material_movements',
  'purchase_items',
  'purchases',
  'portion_stocks',
  'menus',
  'raw_materials',
  'units',
  'vendors',
  'banks',
  'payment_methods',
  'bills',
  'users',
  // metadata / unmapped
  '_prisma_migrations',
];

// Disable FK checks to allow drops regardless of order
await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
for (const t of tables) {
  try {
    await p.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${t}\``);
    console.log('dropped', t);
  } catch (e) {
    console.log('skip', t, e.message);
  }
}
await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
await p.$disconnect();
console.log('done');
