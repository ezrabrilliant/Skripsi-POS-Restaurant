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
import transactionRoutes from './modules/transactions/transactions.routes';
import settlementRoutes from './modules/settlements/settlements.routes';
import userRoutes from './modules/users/users.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import billRoutes from './modules/bills/bills.routes';
import banksRoutes from './modules/banks/banks.routes';
import paymentMethodsRoutes from './modules/payment-methods/payment-methods.routes';
import settingsRoutes from './modules/settings/settings.routes';
// REV 2.2: modul `tables` dihapus (table number jadi field di Transaction, 9 meja fixed)
// REV 2.2: modul `expenses` dihapus (split jadi `purchases` di Phase 7 + `bills` di Phase 8)
// REV 2.11: modul `vendors` + `purchases` + `units` dihapus (belanja/raw-materials
//   out of scope; biaya bahan baku ditangani via COGS per menu). Raw-materials
//   sub-router di-unmount dari modul `stocks` (portion stock tetap ada).

export function createApp() {
  const app = express();

  // Middleware global
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  // Health check - dipakai untuk memastikan server hidup
  app.get('/api/health', (_req, res) => {
    sendSuccess(res, { timestamp: new Date().toISOString() }, 'POS Restaurant API berjalan');
  });

  // Route modul
  app.use('/api/auth', authRoutes);
  app.use('/api/menus', menuRoutes);
  app.use('/api/stocks', stockRoutes);
  app.use('/api/shifts', shiftRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/settlements', settlementRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/bills', billRoutes);
  app.use('/api/banks', banksRoutes);
  app.use('/api/payment-methods', paymentMethodsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Penangan error harus paling akhir
  app.use(errorHandler);

  return app;
}
