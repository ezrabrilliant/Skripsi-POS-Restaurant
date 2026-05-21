// Route modul stok harian.
// Baca: semua user login. Tulis: kitchen (input stok pagi) dan owner.

import { Router } from 'express';
import * as stockController from './stocks.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// Semua route stok butuh login.
router.use(authenticate);

// Baca — semua peran (kasir perlu lihat stok saat order).
router.get('/', asyncHandler(stockController.list));
router.get('/status', asyncHandler(stockController.status));

// Tulis — hanya kitchen dan owner.
const canWrite = requireRole('kitchen', 'owner');
router.post('/', canWrite, asyncHandler(stockController.create));
router.post('/bulk', canWrite, asyncHandler(stockController.bulkCreate));
router.post('/reset-today', canWrite, asyncHandler(stockController.resetToday));
router.post('/copy-yesterday', canWrite, asyncHandler(stockController.copyYesterday));
router.put('/:id', canWrite, asyncHandler(stockController.update));

export default router;
