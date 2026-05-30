// Root router modul stocks. Memounting sub-resource:
//   /api/stocks/portion       -> operasi stok porsi (Phase 5)
//
// REV 2.11: sub-resource /api/stocks/raw-materials dihapus (raw-materials out of
// scope; biaya bahan baku ditangani via COGS per menu). Hanya portion stock tersisa.
//
// app.ts cukup `app.use('/api/stocks', stocksRoutes)`.

import { Router } from 'express';
import portionRoutes from './portion.routes';

const router = Router();

router.use('/portion', portionRoutes);

export default router;
