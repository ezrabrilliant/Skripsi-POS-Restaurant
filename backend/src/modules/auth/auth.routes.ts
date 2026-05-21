// Definisi route modul auth.

import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// Publik — tidak butuh token
router.post('/login', asyncHandler(authController.login));

// Butuh token valid
router.post('/logout', authenticate, asyncHandler(authController.logout));
router.get('/me', authenticate, asyncHandler(authController.me));
router.post('/verify-pin', authenticate, asyncHandler(authController.verifyPin));

export default router;
