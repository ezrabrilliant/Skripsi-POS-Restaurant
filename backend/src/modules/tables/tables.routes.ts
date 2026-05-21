// Route modul meja. Operasional POS — kasir & owner.

import { Router } from 'express';
import * as tableController from './tables.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('cashier', 'owner'));

router.get('/', asyncHandler(tableController.list));
router.get('/:tableNumber/transaction', asyncHandler(tableController.openTransaction));
router.post('/:fromTable/transfer', asyncHandler(tableController.transfer));

export default router;
