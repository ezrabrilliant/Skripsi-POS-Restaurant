import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticate, authorizeOwner } from '../middleware/auth.js';

const router = Router();

// Helper: Get today's date at midnight
const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

// GET /api/stocks - Get today's stock for all menus
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const today = getToday();

    const stocks = await prisma.dailyMenuStock.findMany({
      where: { date: today },
      include: {
        menu: {
          select: {
            id: true,
            name: true,
            category: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        menu: { category: 'asc' },
      },
    });

    const result = stocks.map((stock) => ({
      id: stock.id,
      menuId: stock.menuId,
      menuName: stock.menu.name,
      category: stock.menu.category,
      isActive: stock.menu.isActive,
      stockStart: stock.stockStart,
      stockSold: stock.stockSold,
      stockRemaining: stock.stockStart - stock.stockSold,
      date: stock.date,
    }));

    res.json({
      success: true,
      data: result,
    });
  })
);

// POST /api/stocks/initialize - Initialize daily stock
router.post(
  '/initialize',
  authenticate,
  asyncHandler(async (req, res) => {
    const today = getToday();
    const { stocks } = req.body;

    // If stocks provided, use them; otherwise use defaults
    if (stocks && Array.isArray(stocks)) {
      // Custom stock initialization
      for (const item of stocks) {
        await prisma.dailyMenuStock.upsert({
          where: {
            date_menuId: {
              date: today,
              menuId: item.menuId,
            },
          },
          update: {
            stockStart: item.stockStart,
          },
          create: {
            date: today,
            menuId: item.menuId,
            stockStart: item.stockStart,
            stockSold: 0,
          },
        });
      }
    } else {
      // Default stock initialization
      const menus = await prisma.menu.findMany({
        where: { isActive: true },
      });

      for (const menu of menus) {
        const defaultStock =
          menu.category === 'Makanan Utama' ? 30 :
          menu.category === 'Minuman' ? 50 : 20;

        await prisma.dailyMenuStock.upsert({
          where: {
            date_menuId: {
              date: today,
              menuId: menu.id,
            },
          },
          update: {},
          create: {
            date: today,
            menuId: menu.id,
            stockStart: defaultStock,
            stockSold: 0,
          },
        });
      }
    }

    res.json({
      success: true,
      message: 'Stock harian berhasil diinisialisasi',
    });
  })
);

// PUT /api/stocks/:menuId - Update stock for specific menu
router.put(
  '/:menuId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { menuId } = req.params;
    const { stockStart, addStock } = req.body;
    const today = getToday();

    // Check if menu exists
    const menu = await prisma.menu.findUnique({ where: { id: menuId } });
    if (!menu) {
      throw new AppError('Menu tidak ditemukan', 404);
    }

    // Get existing stock
    let existingStock = await prisma.dailyMenuStock.findUnique({
      where: {
        date_menuId: {
          date: today,
          menuId,
        },
      },
    });

    if (existingStock && addStock) {
      // Add to existing stock
      existingStock = await prisma.dailyMenuStock.update({
        where: { id: existingStock.id },
        data: {
          stockStart: existingStock.stockStart + addStock,
        },
      });
    } else if (stockStart !== undefined) {
      // Set specific stock amount
      existingStock = await prisma.dailyMenuStock.upsert({
        where: {
          date_menuId: {
            date: today,
            menuId,
          },
        },
        update: {
          stockStart,
        },
        create: {
          date: today,
          menuId,
          stockStart,
          stockSold: 0,
        },
      });
    }

    res.json({
      success: true,
      data: {
        menuId,
        menuName: menu.name,
        stockStart: existingStock?.stockStart ?? 0,
        stockSold: existingStock?.stockSold ?? 0,
        stockRemaining: (existingStock?.stockStart ?? 0) - (existingStock?.stockSold ?? 0),
      },
    });
  })
);

// POST /api/stocks/increment-sold - Increment stock sold (called on order)
router.post(
  '/increment-sold',
  authenticate,
  asyncHandler(async (req, res) => {
    const { menuId, quantity } = req.body;
    const today = getToday();

    if (!menuId || !quantity) {
      throw new AppError('menuId dan quantity harus diisi', 400);
    }

    const stock = await prisma.dailyMenuStock.findUnique({
      where: {
        date_menuId: {
          date: today,
          menuId,
        },
      },
    });

    if (!stock) {
      throw new AppError('Stock tidak ditemukan. Inisialisasi stock terlebih dahulu.', 404);
    }

    const updated = await prisma.dailyMenuStock.update({
      where: { id: stock.id },
      data: {
        stockSold: stock.stockSold + quantity,
      },
    });

    res.json({
      success: true,
      data: {
        menuId,
        stockStart: updated.stockStart,
        stockSold: updated.stockSold,
        stockRemaining: updated.stockStart - updated.stockSold,
      },
    });
  })
);

// POST /api/stocks/decrement-sold - Decrement stock sold (for voided orders)
router.post(
  '/decrement-sold',
  authenticate,
  asyncHandler(async (req, res) => {
    const { menuId, quantity } = req.body;
    const today = getToday();

    if (!menuId || !quantity) {
      throw new AppError('menuId dan quantity harus diisi', 400);
    }

    const stock = await prisma.dailyMenuStock.findUnique({
      where: {
        date_menuId: {
          date: today,
          menuId,
        },
      },
    });

    if (!stock) {
      throw new AppError('Stock tidak ditemukan', 404);
    }

    const updated = await prisma.dailyMenuStock.update({
      where: { id: stock.id },
      data: {
        stockSold: Math.max(0, stock.stockSold - quantity),
      },
    });

    res.json({
      success: true,
      data: {
        menuId,
        stockStart: updated.stockStart,
        stockSold: updated.stockSold,
        stockRemaining: updated.stockStart - updated.stockSold,
      },
    });
  })
);

export default router;
