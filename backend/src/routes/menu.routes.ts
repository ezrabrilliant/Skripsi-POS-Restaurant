import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticate, authorizeOwner, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Helper: Get today's date at midnight
const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

// GET /api/menus - Get all menus with today's stock
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const today = getToday();
    const { category, active } = req.query;

    const where: any = {};
    if (category) where.category = category;
    if (active !== undefined) where.isActive = active === 'true';

    const menus = await prisma.menu.findMany({
      where,
      include: {
        dailyStocks: {
          where: { date: today },
          take: 1,
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Transform to include stock info
    const menusWithStock = menus.map((menu) => {
      const stock = menu.dailyStocks[0];
      return {
        id: menu.id,
        name: menu.name,
        price: Number(menu.price),
        category: menu.category,
        description: menu.description,
        isActive: menu.isActive,
        stockStart: stock?.stockStart ?? 0,
        stockSold: stock?.stockSold ?? 0,
        stockRemaining: stock ? stock.stockStart - stock.stockSold : 0,
      };
    });

    res.json({
      success: true,
      data: menusWithStock,
    });
  })
);

// GET /api/menus/categories - Get all categories
router.get(
  '/categories',
  authenticate,
  asyncHandler(async (req, res) => {
    const categories = await prisma.menu.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    res.json({
      success: true,
      data: categories.map((c) => c.category),
    });
  })
);

// GET /api/menus/:id - Get single menu
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const today = getToday();

    const menu = await prisma.menu.findUnique({
      where: { id },
      include: {
        dailyStocks: {
          where: { date: today },
          take: 1,
        },
      },
    });

    if (!menu) {
      throw new AppError('Menu tidak ditemukan', 404);
    }

    const stock = menu.dailyStocks[0];
    const result = {
      id: menu.id,
      name: menu.name,
      price: Number(menu.price),
      category: menu.category,
      description: menu.description,
      isActive: menu.isActive,
      stockStart: stock?.stockStart ?? 0,
      stockSold: stock?.stockSold ?? 0,
      stockRemaining: stock ? stock.stockStart - stock.stockSold : 0,
    };

    res.json({
      success: true,
      data: result,
    });
  })
);

// POST /api/menus - Create menu (owner only)
router.post(
  '/',
  authenticate,
  authorizeOwner,
  asyncHandler(async (req, res) => {
    const { name, price, category, description } = req.body;

    if (!name || !price || !category) {
      throw new AppError('Nama, harga, dan kategori harus diisi', 400);
    }

    const menu = await prisma.menu.create({
      data: {
        name,
        price,
        category,
        description,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...menu,
        price: Number(menu.price),
      },
    });
  })
);

// PUT /api/menus/:id - Update menu (owner only)
router.put(
  '/:id',
  authenticate,
  authorizeOwner,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, price, category, description, isActive } = req.body;

    const existingMenu = await prisma.menu.findUnique({ where: { id } });
    if (!existingMenu) {
      throw new AppError('Menu tidak ditemukan', 404);
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (category) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const menu = await prisma.menu.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: {
        ...menu,
        price: Number(menu.price),
      },
    });
  })
);

// DELETE /api/menus/:id - Deactivate menu (soft delete)
router.delete(
  '/:id',
  authenticate,
  authorizeOwner,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.menu.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Menu berhasil dinonaktifkan',
    });
  })
);

export default router;
