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
  handleCashierDashboard,
  handleWaiterDashboard,
} from './dashboard.controller';

const router = Router();
router.use(authenticate);

router.get('/owner', requireRole(UserRole.owner), handleOwnerReport);
router.get('/cashier', requireRole(UserRole.owner, UserRole.cashier), handleCashierDashboard);
router.get('/waiter', handleWaiterDashboard);

export default router;
