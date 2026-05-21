// Route modul transaksi. Operasional POS — kasir & owner.

import { Router } from 'express';
import * as txController from './transactions.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('cashier', 'owner'));

// Route literal didaftarkan sebelum '/:id' agar tidak tertangkap sebagai parameter.
router.get('/history', asyncHandler(txController.history));
router.get('/daily-summary', asyncHandler(txController.dailySummary));
router.get('/', asyncHandler(txController.listOpen));
router.post('/', asyncHandler(txController.create));

router.get('/:id', asyncHandler(txController.show));
router.put('/:id/items', asyncHandler(txController.syncItems));
router.post('/:id/items', asyncHandler(txController.addItem));
router.put('/:id/items/:itemId', asyncHandler(txController.updateItem));
router.delete('/:id/items/:itemId', asyncHandler(txController.removeItem));
router.post('/:id/pay', asyncHandler(txController.pay));
router.post('/:id/void', asyncHandler(txController.voidTx));

export default router;
