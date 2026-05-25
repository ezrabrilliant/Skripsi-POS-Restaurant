// Routes modul menus. REV 2.3 permission matrix:
//   - GET (list/detail) -> public; semua role butuh lihat menu untuk POS.
//   - POST / PUT / DELETE / reactivate -> owner only (CRUD master).

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  handleList,
  handleDetail,
  handleCreate,
  handleUpdate,
  handleDeactivate,
  handleReactivate,
} from './menus.controller';

const router = Router();

// Public reads
router.get('/', handleList);
router.get('/:id', handleDetail);

// Owner-only mutations
router.post('/', authenticate, requireRole(UserRole.owner), handleCreate);
router.put('/:id', authenticate, requireRole(UserRole.owner), handleUpdate);
router.delete('/:id', authenticate, requireRole(UserRole.owner), handleDeactivate);
router.post('/:id/reactivate', authenticate, requireRole(UserRole.owner), handleReactivate);

export default router;
