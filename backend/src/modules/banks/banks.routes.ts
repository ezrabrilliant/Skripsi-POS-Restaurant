// Routes modul banks. REV 2.6: owner-only semua endpoint.
// Soft delete via PATCH isActive=false (tidak ada DELETE hard-delete per Decision #9).

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  handleList,
  handleDetail,
  handleCreate,
  handleUpdate,
} from './banks.controller';

const router = Router();
router.use(authenticate, requireRole(UserRole.owner));

router.get('/', handleList);
router.post('/', handleCreate);
router.get('/:id', handleDetail);
router.patch('/:id', handleUpdate);

export default router;
