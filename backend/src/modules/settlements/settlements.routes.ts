// Routes modul settlements. Permission per matrix REV 2.3:
//   - GET /preview, POST /, GET /, GET /:id -> owner + kasir
//     (kasir-malam-own enforcement inline di service untuk POST)
//   - PUT /:id/review                       -> OWNER ONLY

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  handlePreview,
  handleCreate,
  handleList,
  handleDetail,
  handleReview,
} from './settlements.controller';

const router = Router();
router.use(authenticate);

const ownerOrCashier = requireRole(UserRole.owner, UserRole.cashier);
const ownerOnly = requireRole(UserRole.owner);

router.get('/preview', ownerOrCashier, handlePreview);
router.post('/', ownerOrCashier, handleCreate);
router.get('/', ownerOrCashier, handleList);
router.get('/:id', ownerOrCashier, handleDetail);
router.put('/:id/review', ownerOnly, handleReview);

export default router;
