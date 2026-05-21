// Route modul shift. Hanya kasir & owner yang mengoperasikan kasir.

import { Router } from 'express';
import * as shiftController from './shifts.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('cashier', 'owner'));

router.post('/open', asyncHandler(shiftController.open));
router.get('/current', asyncHandler(shiftController.current));

export default router;
