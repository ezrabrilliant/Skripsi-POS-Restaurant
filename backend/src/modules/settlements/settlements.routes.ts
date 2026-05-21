// Route modul settlement.
// Submit & lihat: kasir + owner. Review: owner saja.

import { Router } from 'express';
import * as settlementController from './settlements.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('cashier', 'owner'));

// Route literal sebelum '/:id'.
router.get('/preview', asyncHandler(settlementController.preview));
router.get('/', asyncHandler(settlementController.list));
router.post('/', asyncHandler(settlementController.create));
router.get('/:id', asyncHandler(settlementController.show));
router.post('/:id/review', requireRole('owner'), asyncHandler(settlementController.review));

export default router;
