// REV 2.12: upload logo restoran. Reuse `uploadMiddleware` (multer.single('file'))
// dari menus.upload; simpan ke frontend/public/branding/ + convert WebP via sharp.
// Konsisten dengan handleUploadImage menu, beda folder + ukuran (logo lebih kecil).

import type { Request, Response } from 'express';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';

const BRANDING_DIR = path.resolve(process.cwd(), '../frontend/public/branding');

fs.mkdir(BRANDING_DIR, { recursive: true }).catch(() => {
  // Silent - kalau gagal, upload pertama menampilkan error proper.
});

export const handleUploadLogo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError('File logo wajib di-upload (field: file)', 400);
  }
  const filename = `logo-${Date.now()}.webp`;
  const targetPath = path.join(BRANDING_DIR, filename);
  try {
    await sharp(req.file.buffer)
      .rotate()
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(targetPath);
  } catch {
    throw new AppError('Gagal memproses gambar logo. Pastikan file gambar valid.', 400);
  }
  sendSuccess(res, { imageUrl: `/branding/${filename}` }, 'Logo berhasil diunggah');
});
