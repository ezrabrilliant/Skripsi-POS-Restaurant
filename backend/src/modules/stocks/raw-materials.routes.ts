// Routes untuk operasi raw materials (di-mount di /api/stocks/raw-materials).
// Permission:
//   - GET (list/detail)             -> semua authenticated (kasir/waiter butuh tahu untuk reminder)
//   - POST /opname, /:id/mark-habis -> semua authenticated (opname terbuka per matrix)
//   - POST /, PUT /:id, DELETE /:id, /:id/reactivate -> OWNER + KASIR (REV 2.8.1: dibuka
//     ke kasir karena kasir yang belanja & perlu mendaftarkan/koreksi bahan baru tanpa
//     menunggu owner login). Waiter tetap tidak. Menu CRUD TETAP owner-only (beda kebijakan).

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
  handleReactivate,
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

// Owner + Kasir (REV 2.8.1)
const ownerOrCashier = requireRole(UserRole.owner, UserRole.cashier);
router.post('/', ownerOrCashier, handleCreate);
router.put('/:id', ownerOrCashier, handleUpdate);
router.delete('/:id', ownerOrCashier, handleDelete);
// REV 2.5.2: reactivate item yang sebelumnya di-soft-delete.
router.post('/:id/reactivate', ownerOrCashier, handleReactivate);

export default router;
