// Routes modul settings. REV 2.6: GET semua role authenticated (PaymentModal baca
// tax setting), PATCH owner-only (ubah PB1 toggle + rate dari tab Pajak).

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { handleGet, handleUpdate } from './settings.controller';

const router = Router();
router.use(authenticate);

router.get('/', handleGet);
router.patch('/', requireRole(UserRole.owner), handleUpdate);

export default router;
