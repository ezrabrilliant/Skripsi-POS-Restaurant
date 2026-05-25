// Routes modul auth.
//   POST /api/auth/login  -> public, terbitkan JWT
//   GET  /api/auth/me     -> authenticated, balikkan profil pemilik token
//
// REV 2.3 catatan: endpoint /users-public DIHAPUS. Frontend tidak lagi
// pre-fetch daftar nama; setiap login pegawai ketik nama manual di form.

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { handleLogin, handleMe } from './auth.controller';

const router = Router();

router.post('/login', handleLogin);
router.get('/me', authenticate, handleMe);

export default router;
