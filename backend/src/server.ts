// Titik masuk aplikasi: membangun app lalu mulai mendengarkan koneksi.

import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Server API POS berjalan di http://localhost:${env.PORT}`);
});
