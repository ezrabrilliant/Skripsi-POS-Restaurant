// Konversi foto menu sumber (docs/gambar makanan/*.jpeg) menjadi WebP
// terkompresi (600px max, q75) lalu simpan ke frontend/public/menu/.
//
// WebP dipilih karena: dukungan luas semua browser modern, ukuran rata-rata
// 30-50% lebih kecil dari JPEG pada kualitas setara. File kecil = render
// cepat di HP kasir saat wifi resto lambat.
//
// File hasil di-cache otomatis oleh service worker PWA (lihat
// frontend/vite.config.ts) sehingga kunjungan kedua menampilkan gambar
// langsung dari cache device tanpa hit jaringan.
//
// Jalankan: npm run menu:optimize-images

import { mkdir, readdir, stat } from 'node:fs/promises';
import { resolve, basename, extname, join } from 'node:path';
import sharp from 'sharp';

const SOURCE_DIR = resolve(__dirname, '../../docs/gambar makanan');
const OUTPUT_DIR = resolve(__dirname, '../../frontend/public/menu');
const MAX_DIMENSION = 600;
const WEBP_QUALITY = 75;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '') // hapus ekstensi
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const entries = await readdir(SOURCE_DIR);
  const images = entries.filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

  if (images.length === 0) {
    console.warn(`Tidak ada gambar ditemukan di ${SOURCE_DIR}`);
    return;
  }

  console.log(`Optimasi ${images.length} gambar -> ${OUTPUT_DIR}`);

  for (const file of images) {
    const srcPath = join(SOURCE_DIR, file);
    const slug = slugify(file);
    const outPath = join(OUTPUT_DIR, `${slug}.webp`);

    const srcSize = (await stat(srcPath)).size;

    await sharp(srcPath)
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outPath);

    const outSize = (await stat(outPath)).size;
    const reduction = (((srcSize - outSize) / srcSize) * 100).toFixed(0);
    console.log(
      `  ${basename(file)} (${(srcSize / 1024).toFixed(0)} KB) -> ${slug}.webp (${(outSize / 1024).toFixed(0)} KB, -${reduction}%)`
    );
  }

  console.log('Selesai.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
