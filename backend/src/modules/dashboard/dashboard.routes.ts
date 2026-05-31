// Routes modul dashboard. Permission per matrix REV 2.3:
//   - GET /owner   -> OWNER only (laporan finansial penuh dengan period filter)
//   - GET /cashier -> owner + kasir (kasir laporan hari ini saja per matrix)
//   - GET /waiter  -> semua authenticated (waiter primary, owner+kasir juga bisa)

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  handleOwnerReport,
  handleOwnerMenuPerformance,
  handleOwnerTrend,
  handleOwnerStaff,
  handleCashierDashboard,
  handleWaiterDashboard,
} from './dashboard.controller';

const router = Router();
router.use(authenticate);

router.get('/owner', requireRole(UserRole.owner), handleOwnerReport);
// REV 2.13: analitik owner tab (lazy-loaded per tab di FE). Owner-only.
router.get('/owner/menu-performance', requireRole(UserRole.owner), handleOwnerMenuPerformance);
router.get('/owner/trend', requireRole(UserRole.owner), handleOwnerTrend);
router.get('/owner/staff', requireRole(UserRole.owner), handleOwnerStaff);
router.get('/cashier', requireRole(UserRole.owner, UserRole.cashier), handleCashierDashboard);
router.get('/waiter', handleWaiterDashboard);

export default router;
