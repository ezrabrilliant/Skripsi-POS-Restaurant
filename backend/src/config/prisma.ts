// Instance PrismaClient tunggal yang dipakai seluruh aplikasi.
// Membuat banyak instance akan menghabiskan connection pool MySQL.

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
