// Route modul dashboard — owner-only.

import { Router } from 'express';
import * as dashboardController from './dashboard.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('owner'));

router.get('/daily', asyncHandler(dashboardController.daily));
router.get('/summary', asyncHandler(dashboardController.summary));

export default router;
