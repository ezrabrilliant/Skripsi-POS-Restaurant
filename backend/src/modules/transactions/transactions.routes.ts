// Routes modul transactions. Permission per matrix REV 2.3:
//   - POST /                  -> semua authenticated (kasir primary, waiter fallback)
//   - GET /                   -> semua authenticated
//   - GET /:id                -> semua authenticated
//   - POST /:id/items         -> semua authenticated (multi-round order)
//   - POST /:id/payment       -> owner + cashier (payment menyangkut uang nyata)
//   - POST /:id/void          -> owner + cashier (void = transaksi batal, dampak stok)

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  handleCreate,
  handleAddItems,
  handlePayment,
  handleVoid,
  handleDetail,
  handleList,
  handleSplit,
  handleMerge,
} from './transactions.controller';

const router = Router();

router.use(authenticate);

// Semua authenticated boleh
router.post('/', handleCreate);
router.get('/', handleList);
router.get('/:id', handleDetail);
router.post('/:id/items', handleAddItems);

// Owner + cashier saja
const ownerOrCashier = requireRole(UserRole.owner, UserRole.cashier);
router.post('/:id/payment', ownerOrCashier, handlePayment);
router.post('/:id/void', ownerOrCashier, handleVoid);

// REV 2.3 Phase 4b — split + merge bill (owner + cashier per matrix)
router.put('/:id/split', ownerOrCashier, handleSplit);
router.post('/merge', ownerOrCashier, handleMerge);

export default router;
