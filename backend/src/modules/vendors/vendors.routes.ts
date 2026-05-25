// Routes modul vendors. Permission per matrix REV 2.3:
//   - CRUD (list/detail/create/update/delete) -> owner + kasir
//     (waiter tidak terlibat di belanja pasar / vendor management)

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
} from './vendors.controller';

const router = Router();
router.use(authenticate, requireRole(UserRole.owner, UserRole.cashier));

router.get('/', handleList);
router.post('/', handleCreate);
router.get('/:id', handleDetail);
router.put('/:id', handleUpdate);
router.delete('/:id', handleDelete);

export default router;
