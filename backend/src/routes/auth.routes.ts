import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login - Login with PIN
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { pin } = req.body;

    if (!pin || pin.length !== 6) {
      throw new AppError('PIN harus 6 digit', 400);
    }

    // Find all active users and check PIN
    const users = await prisma.user.findMany({
      where: { isActive: true },
    });

    let authenticatedUser = null;

    for (const user of users) {
      const isMatch = await bcrypt.compare(pin, user.pinCode);
      if (isMatch) {
        authenticatedUser = user;
        break;
      }
    }

    if (!authenticatedUser) {
      throw new AppError('PIN salah', 401);
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: authenticatedUser.id,
        name: authenticatedUser.name,
        role: authenticatedUser.role,
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: authenticatedUser.id,
          name: authenticatedUser.name,
          role: authenticatedUser.role,
        },
        token,
      },
    });
  })
);

// GET /api/auth/me - Get current user
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError('User tidak ditemukan', 404);
    }

    res.json({
      success: true,
      data: user,
    });
  })
);

// POST /api/auth/change-pin - Change PIN
router.post(
  '/change-pin',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currentPin, newPin } = req.body;

    if (!currentPin || !newPin) {
      throw new AppError('PIN lama dan baru harus diisi', 400);
    }

    if (newPin.length !== 6) {
      throw new AppError('PIN baru harus 6 digit', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      throw new AppError('User tidak ditemukan', 404);
    }

    const isMatch = await bcrypt.compare(currentPin, user.pinCode);
    if (!isMatch) {
      throw new AppError('PIN lama salah', 401);
    }

    const hashedPin = await bcrypt.hash(newPin, 10);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { pinCode: hashedPin },
    });

    res.json({
      success: true,
      message: 'PIN berhasil diubah',
    });
  })
);

export default router;
