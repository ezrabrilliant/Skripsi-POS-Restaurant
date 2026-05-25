// Routes modul users. Semua endpoint owner-only per Permission Matrix REV 2.3
// (lihat docs/operasional-resto.md seksi Permission Matrix baris "CRUD user").
//
// REV 2.3 catatan: endpoint publik untuk dropdown list pegawai (GET /users-public)
// sudah DIHAPUS. Login form tidak lagi pre-fetch daftar nama.

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
} from './users.controller';

const router = Router();

// Semua endpoint butuh JWT valid + role owner
router.use(authenticate, requireRole(UserRole.owner));

router.get('/', handleList);
router.get('/:id', handleDetail);
router.post('/', handleCreate);
router.put('/:id', handleUpdate);
router.delete('/:id', handleDeactivate);

export default router;
