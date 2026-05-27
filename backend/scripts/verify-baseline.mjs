import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log({
  users: await p.user.count(),
  menus: await p.menu.count(),
  payment_methods: await p.paymentMethod.count(),
  banks: await p.bank.count(),
  junctions: await p.paymentMethodBank.count(),
  settlements: await p.settlement.count(),
  transactions: await p.transaction.count(),
});
await p.$disconnect();
