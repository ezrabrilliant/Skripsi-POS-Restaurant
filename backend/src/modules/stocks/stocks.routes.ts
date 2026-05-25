// Root router modul stocks. Memounting sub-resource:
//   /api/stocks/portion       -> operasi stok porsi (Phase 5)
//   /api/stocks/raw-materials -> operasi raw materials (Phase 6)
//
// app.ts cukup `app.use('/api/stocks', stocksRoutes)`.

import { Router } from 'express';
import portionRoutes from './portion.routes';
import rawMaterialsRoutes from './raw-materials.routes';

const router = Router();

router.use('/portion', portionRoutes);
router.use('/raw-materials', rawMaterialsRoutes);

export default router;
