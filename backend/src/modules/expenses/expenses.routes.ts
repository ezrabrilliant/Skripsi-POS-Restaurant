// Route modul pengeluaran — seluruhnya owner-only.

import { Router } from 'express';
import * as expenseController from './expenses.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('owner'));

router.get('/', asyncHandler(expenseController.list));
router.get('/:id', asyncHandler(expenseController.show));
router.post('/', asyncHandler(expenseController.create));
router.put('/:id', asyncHandler(expenseController.update));
router.delete('/:id', asyncHandler(expenseController.remove));

export default router;
