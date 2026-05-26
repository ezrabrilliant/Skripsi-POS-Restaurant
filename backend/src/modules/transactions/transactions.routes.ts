// Routes modul transactions. REV 2.5 Permission per matrix REV 2.3:
//   - POST /                              -> semua authenticated (waiter + kasir co-equal)
//   - GET /                               -> semua authenticated
//   - GET /:id                            -> semua authenticated
//   - GET /table/:tableNumber             -> semua authenticated
//   - POST /:id/items                     -> semua authenticated (multi-round order)
//   - PATCH /:id/items/:itemId            -> semua authenticated (edit qty/notes)
//   - DELETE /:id/items/:itemId           -> semua authenticated (hapus item)
//   - POST /:id/payments                  -> owner + cashier (REV 2.5: add payment slice)
//   - DELETE /:id/payments/:paymentId     -> owner + cashier (REV 2.5: remove slice)
//   - POST /:id/void                      -> owner + cashier
//   - POST /merge                         -> owner + cashier (REV 2.5: combine tables)
//   - POST /:id/unmerge                   -> owner + cashier (REV 2.5: undo combine, target belum bayar)

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  handleCreate,
  handleAddItems,
  handleDeleteItem,
  handleUpdateItem,
  handleAddPayment,
  handleRemovePayment,
  handleVoid,
  handleDetail,
  handleList,
  handleListByTable,
  handleMerge,
  handleUnmerge,
} from './transactions.controller';

const router = Router();

router.use(authenticate);

// Semua authenticated boleh
router.post('/', handleCreate);
router.get('/', handleList);
// REV 2.4: route by-table sebelum /:id biar tidak ditangkap sebagai param.
router.get('/table/:tableNumber', handleListByTable);
router.get('/:id', handleDetail);
router.post('/:id/items', handleAddItems);
// REV 2.4: edit Pesanan terbuka - hapus item per-row (reverse stock + audit log)
router.delete('/:id/items/:itemId', handleDeleteItem);
// REV 2.4: update item per-row - qty + notes (stock adjust via delta + audit log)
router.patch('/:id/items/:itemId', handleUpdateItem);

// Owner + cashier saja (REV 2.5: payment slice + void + combine)
const ownerOrCashier = requireRole(UserRole.owner, UserRole.cashier);
router.post('/:id/payments', ownerOrCashier, handleAddPayment);
router.delete('/:id/payments/:paymentId', ownerOrCashier, handleRemovePayment);
router.post('/:id/void', ownerOrCashier, handleVoid);
router.post('/merge', ownerOrCashier, handleMerge);
router.post('/:id/unmerge', ownerOrCashier, handleUnmerge);

export default router;
