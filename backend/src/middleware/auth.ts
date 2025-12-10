import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: 'owner' | 'cashier';
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token tidak ditemukan', 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'fallback-secret';

    const decoded = jwt.verify(token, secret) as {
      id: string;
      name: string;
      role: 'owner' | 'cashier';
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Token tidak valid', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token sudah kadaluarsa', 401));
    } else {
      next(error);
    }
  }
};

export const authorizeOwner = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user?.role !== 'owner') {
    return next(new AppError('Akses ditolak. Hanya owner yang diizinkan.', 403));
  }
  next();
};
