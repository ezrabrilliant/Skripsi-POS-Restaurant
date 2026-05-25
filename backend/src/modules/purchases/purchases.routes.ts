// Routes modul purchases. Permission per matrix REV 2.3:
//   - GET / + GET /:id           -> owner + kasir (waiter ✗, tidak terlibat belanja)
//   - POST /                     -> owner + kasir (mencatat pembelian belanja pasar)
//
// Update/delete purchase TIDAK ada (REV 2.3 — kalau salah input, catat purchase
// baru sebagai koreksi supaya audit trail tetap utuh).

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { handleList, handleDetail, handleCreate } from './purchases.controller';

const router = Router();
router.use(authenticate, requireRole(UserRole.owner, UserRole.cashier));

router.get('/', handleList);
router.post('/', handleCreate);
router.get('/:id', handleDetail);

export default router;
