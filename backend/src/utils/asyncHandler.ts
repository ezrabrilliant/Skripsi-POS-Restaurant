// Pembungkus handler async. Express 4 tidak otomatis menangkap error dari
// fungsi async - wrapper ini meneruskan error yang dilempar ke errorHandler.

import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncFn): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
