import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticate, authorizeOwner, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Helper: Get date range
const getDateRange = (dateStr: string) => {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// GET /api/settlements - Get settlement history
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { startDate, endDate, limit = '30' } = req.query;

    const where: any = {};

    if (startDate) {
      where.date = { gte: new Date(startDate as string) };
    }
    if (endDate) {
      where.date = { ...where.date, lte: new Date(endDate as string) };
    }

    const settlements = await prisma.settlement.findMany({
      where,
      include: {
        cashier: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: parseInt(limit as string),
    });

    const result = settlements.map((s) => ({
      ...s,
      systemCash: Number(s.systemCash),
      systemEdc: Number(s.systemEdc),
      systemTransfer: Number(s.systemTransfer),
      systemTotal: Number(s.systemTotal),
      actualCash: Number(s.actualCash),
      actualEdc: Number(s.actualEdc),
      actualTransfer: Number(s.actualTransfer),
      actualTotal: Number(s.actualTotal),
      varianceCash: Number(s.actualCash) - Number(s.systemCash),
      varianceEdc: Number(s.actualEdc) - Number(s.systemEdc),
      varianceTotal: Number(s.actualTotal) - Number(s.systemTotal),
    }));

    res.json({
      success: true,
      data: result,
    });
  })
);

// GET /api/settlements/date/:date - Get settlement by date
router.get(
  '/date/:date',
  authenticate,
  asyncHandler(async (req, res) => {
    const { date } = req.params;
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const settlement = await prisma.settlement.findUnique({
      where: { date: dateObj },
      include: {
        cashier: { select: { id: true, name: true } },
      },
    });

    if (!settlement) {
      return res.json({
        success: true,
        data: null,
      });
    }

    res.json({
      success: true,
      data: {
        ...settlement,
        systemCash: Number(settlement.systemCash),
        systemEdc: Number(settlement.systemEdc),
        systemTransfer: Number(settlement.systemTransfer),
        systemTotal: Number(settlement.systemTotal),
        actualCash: Number(settlement.actualCash),
        actualEdc: Number(settlement.actualEdc),
        actualTransfer: Number(settlement.actualTransfer),
        actualTotal: Number(settlement.actualTotal),
        varianceCash: Number(settlement.actualCash) - Number(settlement.systemCash),
        varianceEdc: Number(settlement.actualEdc) - Number(settlement.systemEdc),
        varianceTotal: Number(settlement.actualTotal) - Number(settlement.systemTotal),
      },
    });
  })
);

// GET /api/settlements/calculate/:date - Calculate system totals for a date
router.get(
  '/calculate/:date',
  authenticate,
  asyncHandler(async (req, res) => {
    const { date } = req.params;
    const { start, end } = getDateRange(date);

    const transactions = await prisma.transaction.findMany({
      where: {
        status: 'paid',
        paidAt: { gte: start, lte: end },
      },
    });

    const result = {
      date,
      transactionCount: transactions.length,
      systemCash: 0,
      systemEdc: 0,
      systemTransfer: 0,
      systemTotal: 0,
    };

    transactions.forEach((tx) => {
      const amount = Number(tx.totalAmount);
      result.systemTotal += amount;

      if (tx.paymentMethod === 'cash') {
        result.systemCash += amount;
      } else if (tx.paymentMethod?.startsWith('edc') || tx.paymentMethod === 'qris') {
        result.systemEdc += amount;
      } else if (tx.paymentMethod === 'transfer') {
        result.systemTransfer += amount;
      }
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

// POST /api/settlements - Create or update settlement
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      date,
      actualCash,
      actualEdc,
      actualTransfer,
      varianceReason,
      notes,
    } = req.body;

    if (!date) {
      throw new AppError('Tanggal harus diisi', 400);
    }

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    // Calculate system totals
    const { start, end } = getDateRange(date);

    const transactions = await prisma.transaction.findMany({
      where: {
        status: 'paid',
        paidAt: { gte: start, lte: end },
      },
    });

    let systemCash = 0;
    let systemEdc = 0;
    let systemTransfer = 0;

    transactions.forEach((tx) => {
      const amount = Number(tx.totalAmount);

      if (tx.paymentMethod === 'cash') {
        systemCash += amount;
      } else if (tx.paymentMethod?.startsWith('edc') || tx.paymentMethod === 'qris') {
        systemEdc += amount;
      } else if (tx.paymentMethod === 'transfer') {
        systemTransfer += amount;
      }
    });

    const systemTotal = systemCash + systemEdc + systemTransfer;
    const actualTotal = (actualCash || 0) + (actualEdc || 0) + (actualTransfer || 0);

    // Check if variance exists and reason is required
    const hasVariance = actualTotal !== systemTotal;
    if (hasVariance && !varianceReason) {
      throw new AppError('Alasan selisih harus diisi jika ada perbedaan', 400);
    }

    const settlement = await prisma.settlement.upsert({
      where: { date: dateObj },
      update: {
        cashierId: req.user!.id,
        systemCash,
        systemEdc,
        systemTransfer,
        systemTotal,
        actualCash: actualCash || 0,
        actualEdc: actualEdc || 0,
        actualTransfer: actualTransfer || 0,
        actualTotal,
        varianceReason: hasVariance ? varianceReason : null,
        status: 'submitted',
        notes,
      },
      create: {
        date: dateObj,
        cashierId: req.user!.id,
        systemCash,
        systemEdc,
        systemTransfer,
        systemTotal,
        actualCash: actualCash || 0,
        actualEdc: actualEdc || 0,
        actualTransfer: actualTransfer || 0,
        actualTotal,
        varianceReason: hasVariance ? varianceReason : null,
        status: 'submitted',
        notes,
      },
      include: {
        cashier: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      data: {
        ...settlement,
        systemCash: Number(settlement.systemCash),
        systemEdc: Number(settlement.systemEdc),
        systemTransfer: Number(settlement.systemTransfer),
        systemTotal: Number(settlement.systemTotal),
        actualCash: Number(settlement.actualCash),
        actualEdc: Number(settlement.actualEdc),
        actualTransfer: Number(settlement.actualTransfer),
        actualTotal: Number(settlement.actualTotal),
        varianceCash: Number(settlement.actualCash) - Number(settlement.systemCash),
        varianceEdc: Number(settlement.actualEdc) - Number(settlement.systemEdc),
        varianceTotal: Number(settlement.actualTotal) - Number(settlement.systemTotal),
      },
    });
  })
);

// PUT /api/settlements/:id/review - Review settlement (owner only)
router.put(
  '/:id/review',
  authenticate,
  authorizeOwner,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;

    const settlement = await prisma.settlement.update({
      where: { id },
      data: {
        status: 'reviewed',
        notes,
      },
      include: {
        cashier: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      data: settlement,
    });
  })
);

export default router;
