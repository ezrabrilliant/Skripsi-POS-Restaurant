// Routes modul payment-methods. REV 2.6 permission mix:
//   - GET /payment-methods + GET /:id - semua role authenticated (untuk PaymentModal kasir)
//   - POST/PATCH/DELETE/reorder - owner-only

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  handleList,
  handleDetail,
  handleCreate,
  handleUpdate,
  handleToggleActive,
  handleAssignBank,
  handleUnassignBank,
  handleReorder,
} from './payment-methods.controller';

const router = Router();
router.use(authenticate);

// Read endpoint: semua role authenticated
router.get('/', handleList);
router.get('/:id', handleDetail);

// Owner-only mutations
router.use(requireRole(UserRole.owner));
router.post('/', handleCreate);
router.patch('/:id', handleUpdate);
router.patch('/:id/toggle-active', handleToggleActive);
router.post('/:id/banks/:bankId', handleAssignBank);
router.delete('/:id/banks/:bankId', handleUnassignBank);
router.post('/reorder', handleReorder);

export default router;
