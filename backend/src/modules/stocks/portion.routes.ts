// Routes untuk operasi stok porsi (di-mount di /api/stocks/portion).
// REV 2.3 permission matrix: view + opname + restock + barang masuk + mark habis
// semua TERBUKA untuk owner+kasir+waiter. Cukup `authenticate` (tidak ada requireRole).

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  handleList,
  handleDetail,
  handleRestockMorning,
  handleEmergencyIn,
  handleOpname,
  handleMarkHabis,
} from './portion.controller';

const router = Router();

router.use(authenticate);

router.get('/', handleList);
router.post('/restock-morning', handleRestockMorning);
router.post('/emergency-in', handleEmergencyIn);
router.post('/opname', handleOpname);
router.get('/:menuId', handleDetail);
router.post('/:menuId/mark-habis', handleMarkHabis);

export default router;
