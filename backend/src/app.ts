// Perakitan aplikasi Express: middleware global, route, dan error handler.
// File ini hanya membangun `app`; proses listen ada di server.ts agar mudah diuji.

import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { sendSuccess } from './utils/response';
import authRoutes from './modules/auth/auth.routes';
import menuRoutes from './modules/menus/menus.routes';
import stockRoutes from './modules/stocks/stocks.routes';
import shiftRoutes from './modules/shifts/shifts.routes';
import tableRoutes from './modules/tables/tables.routes';
import transactionRoutes from './modules/transactions/transactions.routes';
import settlementRoutes from './modules/settlements/settlements.routes';
import userRoutes from './modules/users/users.routes';
import expenseRoutes from './modules/expenses/expenses.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

export function createApp() {
  const app = express();

  // Middleware global
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  // Health check — dipakai untuk memastikan server hidup
  app.get('/api/health', (_req, res) => {
    sendSuccess(res, { timestamp: new Date().toISOString() }, 'POS Restaurant API berjalan');
  });

  // Route modul
  app.use('/api/auth', authRoutes);
  app.use('/api/menus', menuRoutes);
  app.use('/api/stocks', stockRoutes);
  app.use('/api/shifts', shiftRoutes);
  app.use('/api/tables', tableRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/settlements', settlementRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Penangan error harus paling akhir
  app.use(errorHandler);

  return app;
}
