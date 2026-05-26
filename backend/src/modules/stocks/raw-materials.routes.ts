// Routes untuk operasi raw materials (di-mount di /api/stocks/raw-materials).
// REV 2.3 permission matrix:
//   - GET (list/detail)             -> semua authenticated (kasir/waiter butuh tahu untuk reminder)
//   - POST /opname, /:id/mark-habis -> semua authenticated (opname terbuka per matrix)
//   - POST /, PUT /:id, DELETE /:id -> OWNER only (edit master: rename, ubah unit,
//     ubah is_tracked, ubah min_stock - per matrix "Edit master raw material")

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
  handleOpname,
  handleMarkHabis,
} from './raw-materials.controller';

const router = Router();
router.use(authenticate);

// Semua authenticated
router.get('/', handleList);
router.post('/opname', handleOpname);
router.get('/:id', handleDetail);
router.post('/:id/mark-habis', handleMarkHabis);

// Owner only
const ownerOnly = requireRole(UserRole.owner);
router.post('/', ownerOnly, handleCreate);
router.put('/:id', ownerOnly, handleUpdate);
router.delete('/:id', ownerOnly, handleDelete);

export default router;
