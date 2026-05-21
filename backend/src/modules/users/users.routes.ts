// Route modul manajemen pengguna — seluruhnya owner-only.

import { Router } from 'express';
import * as userController from './users.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('owner'));

router.get('/', asyncHandler(userController.list));
router.get('/:id', asyncHandler(userController.show));
router.post('/', asyncHandler(userController.create));
router.put('/:id', asyncHandler(userController.update));
router.delete('/:id', asyncHandler(userController.remove));

export default router;
