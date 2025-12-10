import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Prisma } from '@prisma/client';

const router = Router();

// Helper: Get today's date range
const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// Helper: Update stock sold
const updateStockSold = async (menuId: string, quantity: number, increment: boolean = true) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stock = await prisma.dailyMenuStock.findUnique({
    where: {
      date_menuId: {
        date: today,
        menuId,
      },
    },
  });

  if (stock) {
    await prisma.dailyMenuStock.update({
      where: { id: stock.id },
      data: {
        stockSold: increment
          ? stock.stockSold + quantity
          : Math.max(0, stock.stockSold - quantity),
      },
    });
  }
};

// GET /api/transactions - Get transactions with filters
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { status, date, limit = '50' } = req.query;

    const where: Prisma.TransactionWhereInput = {};

    if (status) {
      where.status = status as 'open' | 'paid' | 'void';
    }

    if (date) {
      const dateStart = new Date(date as string);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date as string);
      dateEnd.setHours(23, 59, 59, 999);
      where.createdAt = { gte: dateStart, lte: dateEnd };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        items: true,
        cashier: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    const result = transactions.map((tx) => ({
      ...tx,
      subtotal: Number(tx.subtotal),
      discountAmount: Number(tx.discountAmount),
      totalAmount: Number(tx.totalAmount),
      amountPaid: Number(tx.amountPaid),
      changeAmount: Number(tx.changeAmount),
      items: tx.items.map((item) => ({
        ...item,
        priceAtTime: Number(item.priceAtTime),
        subtotal: Number(item.subtotal),
      })),
    }));

    res.json({
      success: true,
      data: result,
    });
  })
);

// GET /api/transactions/tables - Get table statuses
router.get(
  '/tables',
  authenticate,
  asyncHandler(async (req, res) => {
    // Define available tables
    const tables = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

    // Get open transactions
    const openTransactions = await prisma.transaction.findMany({
      where: { status: 'open' },
      include: {
        items: { select: { id: true } },
      },
    });

    const tableStatuses = tables.map((tableNumber) => {
      const tx = openTransactions.find((t) => t.tableNumber === tableNumber);

      if (tx) {
        return {
          tableNumber,
          status: 'occupied',
          transactionId: tx.id,
          totalAmount: Number(tx.totalAmount),
          itemCount: tx.items.length,
          createdAt: tx.createdAt,
        };
      }

      return {
        tableNumber,
        status: 'empty',
      };
    });

    res.json({
      success: true,
      data: tableStatuses,
    });
  })
);

// GET /api/transactions/:id - Get single transaction
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        items: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    if (!transaction) {
      throw new AppError('Transaksi tidak ditemukan', 404);
    }

    res.json({
      success: true,
      data: {
        ...transaction,
        subtotal: Number(transaction.subtotal),
        discountAmount: Number(transaction.discountAmount),
        totalAmount: Number(transaction.totalAmount),
        amountPaid: Number(transaction.amountPaid),
        changeAmount: Number(transaction.changeAmount),
        items: transaction.items.map((item) => ({
          ...item,
          priceAtTime: Number(item.priceAtTime),
          subtotal: Number(item.subtotal),
        })),
      },
    });
  })
);

// GET /api/transactions/table/:tableNumber - Get open transaction by table
router.get(
  '/table/:tableNumber',
  authenticate,
  asyncHandler(async (req, res) => {
    const { tableNumber } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: {
        tableNumber,
        status: 'open',
      },
      include: {
        items: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    if (!transaction) {
      return res.json({
        success: true,
        data: null,
      });
    }

    res.json({
      success: true,
      data: {
        ...transaction,
        subtotal: Number(transaction.subtotal),
        discountAmount: Number(transaction.discountAmount),
        totalAmount: Number(transaction.totalAmount),
        amountPaid: Number(transaction.amountPaid),
        changeAmount: Number(transaction.changeAmount),
        items: transaction.items.map((item) => ({
          ...item,
          priceAtTime: Number(item.priceAtTime),
          subtotal: Number(item.subtotal),
        })),
      },
    });
  })
);

// POST /api/transactions - Create new transaction
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { tableNumber, items, notes, discountAmount = 0 } = req.body;

    if (!tableNumber) {
      throw new AppError('Nomor meja harus diisi', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Items tidak boleh kosong', 400);
    }

    // Check if table already has open transaction
    const existingTx = await prisma.transaction.findFirst({
      where: { tableNumber, status: 'open' },
    });

    if (existingTx) {
      throw new AppError('Meja ini sudah memiliki pesanan aktif', 400);
    }

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );
    const totalAmount = Math.max(0, subtotal - discountAmount);

    // Create transaction with items
    const transaction = await prisma.transaction.create({
      data: {
        tableNumber,
        cashierId: req.user!.id,
        notes,
        subtotal,
        discountAmount,
        totalAmount,
        items: {
          create: items.map((item: any) => ({
            menuId: item.menuId,
            menuName: item.menuName,
            quantity: item.quantity,
            priceAtTime: item.price,
            subtotal: item.price * item.quantity,
            notes: item.notes || null,
            isForceOrder: item.isForceOrder || false,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // Update stock sold for each item
    for (const item of items) {
      await updateStockSold(item.menuId, item.quantity, true);
    }

    res.status(201).json({
      success: true,
      data: {
        ...transaction,
        subtotal: Number(transaction.subtotal),
        discountAmount: Number(transaction.discountAmount),
        totalAmount: Number(transaction.totalAmount),
        items: transaction.items.map((item) => ({
          ...item,
          priceAtTime: Number(item.priceAtTime),
          subtotal: Number(item.subtotal),
        })),
      },
    });
  })
);

// PUT /api/transactions/:id - Update transaction (add/edit items)
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { items, notes, discountAmount } = req.body;

    const existingTx = await prisma.transaction.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingTx) {
      throw new AppError('Transaksi tidak ditemukan', 404);
    }

    if (existingTx.status !== 'open') {
      throw new AppError('Transaksi sudah ditutup, tidak bisa diedit', 400);
    }

    // Restore old stock
    for (const oldItem of existingTx.items) {
      await updateStockSold(oldItem.menuId, oldItem.quantity, false);
    }

    // Delete old items
    await prisma.transactionItem.deleteMany({
      where: { transactionId: id },
    });

    // Calculate new totals
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );
    const discount = discountAmount ?? Number(existingTx.discountAmount);
    const totalAmount = Math.max(0, subtotal - discount);

    // Update transaction and create new items
    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        notes: notes ?? existingTx.notes,
        discountAmount: discount,
        subtotal,
        totalAmount,
        items: {
          create: items.map((item: any) => ({
            menuId: item.menuId,
            menuName: item.menuName,
            quantity: item.quantity,
            priceAtTime: item.price,
            subtotal: item.price * item.quantity,
            notes: item.notes || null,
            isForceOrder: item.isForceOrder || false,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // Update new stock sold
    for (const item of items) {
      await updateStockSold(item.menuId, item.quantity, true);
    }

    res.json({
      success: true,
      data: {
        ...transaction,
        subtotal: Number(transaction.subtotal),
        discountAmount: Number(transaction.discountAmount),
        totalAmount: Number(transaction.totalAmount),
        items: transaction.items.map((item) => ({
          ...item,
          priceAtTime: Number(item.priceAtTime),
          subtotal: Number(item.subtotal),
        })),
      },
    });
  })
);

// POST /api/transactions/:id/pay - Process payment
router.post(
  '/:id/pay',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { paymentMethod, amountPaid } = req.body;

    if (!paymentMethod || amountPaid === undefined) {
      throw new AppError('Metode pembayaran dan jumlah bayar harus diisi', 400);
    }

    const existingTx = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!existingTx) {
      throw new AppError('Transaksi tidak ditemukan', 404);
    }

    if (existingTx.status !== 'open') {
      throw new AppError('Transaksi sudah dibayar atau dibatalkan', 400);
    }

    const totalAmount = Number(existingTx.totalAmount);
    if (amountPaid < totalAmount) {
      throw new AppError('Jumlah bayar kurang dari total', 400);
    }

    const changeAmount = amountPaid - totalAmount;

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        status: 'paid',
        paymentMethod,
        amountPaid,
        changeAmount,
        paidAt: new Date(),
      },
      include: {
        items: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      data: {
        ...transaction,
        subtotal: Number(transaction.subtotal),
        discountAmount: Number(transaction.discountAmount),
        totalAmount: Number(transaction.totalAmount),
        amountPaid: Number(transaction.amountPaid),
        changeAmount: Number(transaction.changeAmount),
      },
    });
  })
);

// POST /api/transactions/:id/void - Void transaction
router.post(
  '/:id/void',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const existingTx = await prisma.transaction.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingTx) {
      throw new AppError('Transaksi tidak ditemukan', 404);
    }

    if (existingTx.status === 'void') {
      throw new AppError('Transaksi sudah dibatalkan', 400);
    }

    // Restore stock if transaction was open
    if (existingTx.status === 'open') {
      for (const item of existingTx.items) {
        await updateStockSold(item.menuId, item.quantity, false);
      }
    }

    await prisma.transaction.update({
      where: { id },
      data: { status: 'void' },
    });

    res.json({
      success: true,
      message: 'Transaksi berhasil dibatalkan',
    });
  })
);

// POST /api/transactions/split - Split bill
router.post(
  '/split',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { sourceTransactionId, itemIds, newTableNumber } = req.body;

    if (!sourceTransactionId || !itemIds || !newTableNumber) {
      throw new AppError('Data tidak lengkap', 400);
    }

    // Get items to move
    const itemsToMove = await prisma.transactionItem.findMany({
      where: {
        id: { in: itemIds },
        transactionId: sourceTransactionId,
      },
    });

    if (itemsToMove.length === 0) {
      throw new AppError('Items tidak ditemukan', 404);
    }

    // Calculate new totals for source transaction
    const sourceItems = await prisma.transactionItem.findMany({
      where: {
        transactionId: sourceTransactionId,
        id: { notIn: itemIds },
      },
    });

    const sourceSubtotal = sourceItems.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0
    );

    // Create new transaction
    const newSubtotal = itemsToMove.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0
    );

    const newTransaction = await prisma.transaction.create({
      data: {
        tableNumber: newTableNumber,
        cashierId: req.user!.id,
        subtotal: newSubtotal,
        totalAmount: newSubtotal,
      },
    });

    // Move items to new transaction
    await prisma.transactionItem.updateMany({
      where: { id: { in: itemIds } },
      data: { transactionId: newTransaction.id },
    });

    // Update source transaction totals
    await prisma.transaction.update({
      where: { id: sourceTransactionId },
      data: {
        subtotal: sourceSubtotal,
        totalAmount: sourceSubtotal,
      },
    });

    res.json({
      success: true,
      data: {
        newTransactionId: newTransaction.id,
        newTableNumber,
      },
    });
  })
);

// POST /api/transactions/merge - Merge bills
router.post(
  '/merge',
  authenticate,
  asyncHandler(async (req, res) => {
    const { sourceTransactionId, targetTransactionId } = req.body;

    if (!sourceTransactionId || !targetTransactionId) {
      throw new AppError('Source dan target transaction harus diisi', 400);
    }

    // Get source items
    const sourceItems = await prisma.transactionItem.findMany({
      where: { transactionId: sourceTransactionId },
    });

    // Move items to target
    await prisma.transactionItem.updateMany({
      where: { transactionId: sourceTransactionId },
      data: { transactionId: targetTransactionId },
    });

    // Calculate new totals
    const allItems = await prisma.transactionItem.findMany({
      where: { transactionId: targetTransactionId },
    });

    const newSubtotal = allItems.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0
    );

    // Update target transaction
    await prisma.transaction.update({
      where: { id: targetTransactionId },
      data: {
        subtotal: newSubtotal,
        totalAmount: newSubtotal,
      },
    });

    // Void source transaction
    await prisma.transaction.update({
      where: { id: sourceTransactionId },
      data: { status: 'void' },
    });

    res.json({
      success: true,
      message: 'Transaksi berhasil digabung',
    });
  })
);

// GET /api/transactions/summary/today - Get today's summary
router.get(
  '/summary/today',
  authenticate,
  asyncHandler(async (req, res) => {
    const { start, end } = getTodayRange();

    const transactions = await prisma.transaction.findMany({
      where: {
        status: 'paid',
        paidAt: { gte: start, lte: end },
      },
    });

    const summary = {
      totalTransactions: transactions.length,
      cashTotal: 0,
      edcTotal: 0,
      transferTotal: 0,
      grandTotal: 0,
    };

    transactions.forEach((tx) => {
      const amount = Number(tx.totalAmount);
      summary.grandTotal += amount;

      if (tx.paymentMethod === 'cash') {
        summary.cashTotal += amount;
      } else if (tx.paymentMethod?.startsWith('edc') || tx.paymentMethod === 'qris') {
        summary.edcTotal += amount;
      } else if (tx.paymentMethod === 'transfer') {
        summary.transferTotal += amount;
      }
    });

    res.json({
      success: true,
      data: summary,
    });
  })
);

export default router;
