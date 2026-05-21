// Augmentasi tipe Express: menambahkan `req.user` yang diisi oleh middleware auth
// setelah token JWT berhasil diverifikasi.

import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: UserRole;
      };
    }
  }
}

export {};
