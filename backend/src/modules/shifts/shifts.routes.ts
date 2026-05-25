// Routes modul shifts. Permission per matrix REV 2.3:
//   - POST /open               -> kasir only (Owner "–" artinya tidak biasa buka shift)
//   - POST /:id/close          -> owner + kasir (kasir tutup sendiri; owner bisa paksa)
//   - GET /active              -> authenticated (waiter butuh tahu shift aktif untuk fallback)
//   - GET /:id, GET /          -> authenticated (semua role boleh lihat)

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  handleOpen,
  handleClose,
  handleActive,
  handleDetail,
  handleList,
} from './shifts.controller';

const router = Router();

// Semua endpoint butuh authenticate
router.use(authenticate);

router.post('/open', requireRole(UserRole.cashier), handleOpen);
router.post('/:id/close', requireRole(UserRole.owner, UserRole.cashier), handleClose);
router.get('/active', handleActive);
router.get('/', handleList);
router.get('/:id', handleDetail);

export default router;
