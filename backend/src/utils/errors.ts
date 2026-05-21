// AppError: error yang sengaja dilempar oleh logika bisnis dengan kode HTTP
// yang sudah ditentukan. errorHandler akan menerjemahkannya jadi respons rapi.

export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Helper untuk kasus umum. */
export const notFound = (entity = 'Data') => new AppError(`${entity} tidak ditemukan`, 404);
export const unauthorized = (msg = 'Tidak terautentikasi') => new AppError(msg, 401);
export const forbidden = (msg = 'Akses ditolak') => new AppError(msg, 403);
