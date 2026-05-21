// Route modul menu. Baca bersifat publik; tulis butuh peran owner.

import { Router } from 'express';
import * as menuController from './menus.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// Publik (read-only). '/categories' harus didaftarkan sebelum '/:id'
// agar tidak tertangkap sebagai parameter id.
router.get('/', asyncHandler(menuController.list));
router.get('/categories', asyncHandler(menuController.categories));
router.get('/:id', asyncHandler(menuController.show));

// Owner-only (write)
router.post('/', authenticate, requireRole('owner'), asyncHandler(menuController.create));
router.put('/:id', authenticate, requireRole('owner'), asyncHandler(menuController.update));
router.delete('/:id', authenticate, requireRole('owner'), asyncHandler(menuController.remove));

export default router;
