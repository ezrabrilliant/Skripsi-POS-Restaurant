// Routes modul units. Permission per matrix REV 2.3:
//   - GET (list, detail): semua role authenticated
//     (dropdown source untuk raw materials di frontend - kasir & waiter butuh view)
//   - POST/PUT/DELETE: owner only (CRUD master)

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  handleList,
  handleDetail,
  handleCreate,
  handleUpdate,
  handleDelete,
} from './units.controller';

const router = Router();
router.use(authenticate);

// GET semua role authenticated (dropdown source)
router.get('/', handleList);
router.get('/:id', handleDetail);

// CRUD owner only
router.post('/', requireRole(UserRole.owner), handleCreate);
router.put('/:id', requireRole(UserRole.owner), handleUpdate);
router.delete('/:id', requireRole(UserRole.owner), handleDelete);

export default router;
