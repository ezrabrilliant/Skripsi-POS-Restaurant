// Routes modul menus. REV 2.3 permission matrix:
//   - GET (list/detail) -> public; semua role butuh lihat menu untuk POS.
//   - POST / PUT / DELETE / reactivate -> owner only (CRUD master).

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authenticateOptional } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  handleList,
  handleDetail,
  handleCreate,
  handleUpdate,
  handleDeactivate,
  handleReactivate,
  handleCostHistory,
} from './menus.controller';
import { uploadMiddleware, handleUploadImage } from './menus.upload';

const router = Router();

// Public reads (soft auth: owner token → cost included; anon/POS → cost omitted)
router.get('/', authenticateOptional, handleList);
router.get('/:id', authenticateOptional, handleDetail);

// Owner-only riwayat modal (path distinct dari '/:id' jadi ordering aman)
router.get('/:id/cost-history', authenticate, requireRole(UserRole.owner), handleCostHistory);

// Owner-only mutations
router.post(
  '/upload-image',
  authenticate,
  requireRole(UserRole.owner),
  uploadMiddleware,
  handleUploadImage,
);
router.post('/', authenticate, requireRole(UserRole.owner), handleCreate);
router.put('/:id', authenticate, requireRole(UserRole.owner), handleUpdate);
router.delete('/:id', authenticate, requireRole(UserRole.owner), handleDeactivate);
router.post('/:id/reactivate', authenticate, requireRole(UserRole.owner), handleReactivate);

export default router;
