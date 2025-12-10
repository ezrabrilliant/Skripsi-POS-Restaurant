import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticate, authorizeOwner, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/users - Get all users (owner only)
router.get(
  '/',
  authenticate,
  authorizeOwner,
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: users,
    });
  })
);

// POST /api/users - Create new user (owner only)
router.post(
  '/',
  authenticate,
  authorizeOwner,
  asyncHandler(async (req, res) => {
    const { name, role, pin } = req.body;

    if (!name || !role || !pin) {
      throw new AppError('Nama, role, dan PIN harus diisi', 400);
    }

    if (pin.length !== 6) {
      throw new AppError('PIN harus 6 digit', 400);
    }

    if (!['owner', 'cashier'].includes(role)) {
      throw new AppError('Role harus owner atau cashier', 400);
    }

    const hashedPin = await bcrypt.hash(pin, 10);

    const user = await prisma.user.create({
      data: {
        name,
        role,
        pinCode: hashedPin,
      },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      data: user,
    });
  })
);

// PUT /api/users/:id - Update user (owner only)
router.put(
  '/:id',
  authenticate,
  authorizeOwner,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, role, pin, isActive } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      throw new AppError('User tidak ditemukan', 404);
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (pin && pin.length === 6) {
      updateData.pinCode = await bcrypt.hash(pin, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  })
);

// DELETE /api/users/:id - Deactivate user (owner only)
router.delete(
  '/:id',
  authenticate,
  authorizeOwner,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Prevent deleting self
    if (id === req.user!.id) {
      throw new AppError('Tidak bisa menghapus akun sendiri', 400);
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'User berhasil dinonaktifkan',
    });
  })
);

export default router;
