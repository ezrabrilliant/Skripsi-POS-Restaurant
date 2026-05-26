// Image upload handler untuk menu. Menerima multipart file (jpg/png/webp/gif),
// auto-resize max 800px + convert ke WebP quality 80 via sharp, simpan ke
// frontend/public/menu/ supaya konsisten dengan path image existing.

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// Resolusi relatif dari backend cwd (`<root>/backend`) ke `<root>/frontend/public/menu`.
// Konsisten dengan path image existing yang di-serve oleh Vite/PWA.
const UPLOAD_DIR = path.resolve(process.cwd(), '../frontend/public/menu');

// Pastikan direktori upload ada saat modul dimuat
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {
  // Silent - kalau gagal di sini, upload pertama akan menampilkan error proper.
});

// Multer config - memory storage supaya buffer langsung dipipe ke sharp.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `Format file tidak didukung (${file.mimetype}). Gunakan JPG, PNG, WebP, atau GIF.`,
          400,
        ),
      );
    }
  },
});

/**
 * Middleware wrapper untuk multer.single('file') yang menerjemahkan
 * MulterError (mis. LIMIT_FILE_SIZE) jadi AppError standar.
 */
export const uploadMiddleware: RequestHandler = (req, res, next) => {
  const single = upload.single('file');
  single(req, res, (err) => {
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('Ukuran file melebihi 5MB', 400));
      }
      return next(new AppError(`Upload gagal: ${err.message}`, 400));
    }
    if (err) return next(err);
    next();
  });
};

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'menu'
  );
}

export const handleUploadImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError('File foto wajib di-upload (field: file)', 400);
  }

  const nameInput = typeof req.body.name === 'string' ? req.body.name : '';
  const slug = slugify(nameInput || `menu-${Date.now()}`);
  const filename = `${slug}-${Date.now()}.webp`;
  const targetPath = path.join(UPLOAD_DIR, filename);

  try {
    await sharp(req.file.buffer)
      .rotate() // respect EXIF orientation (HP photos sering ter-rotate)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(targetPath);
  } catch {
    throw new AppError(
      'Gagal memproses gambar. Pastikan file adalah gambar yang valid.',
      400,
    );
  }

  sendSuccess(res, { imageUrl: `/menu/${filename}` }, 'Foto berhasil diunggah');
});
