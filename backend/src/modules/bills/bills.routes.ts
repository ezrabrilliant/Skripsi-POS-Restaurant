// Routes modul bills. Permission per matrix REV 2.3:
//   - Bills / tagihan operasional bulanan -> OWNER ONLY
//     (kasir tidak punya akses meski anggota keluarga; gating strict)

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
} from './bills.controller';

const router = Router();
router.use(authenticate, requireRole(UserRole.owner));

router.get('/', handleList);
router.post('/', handleCreate);
router.get('/:id', handleDetail);
router.put('/:id', handleUpdate);
router.delete('/:id', handleDelete);

export default router;
