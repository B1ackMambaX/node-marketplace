import { createApp } from './app';
import { prisma } from './infrastructure/database/client';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be between 1 and 65535');
}
const app = createApp();
await prisma.$connect();
const server = app.listen(port, () => console.log(`Marketplace: http://localhost:${port}/docs`));
server.on('error', async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
let shuttingDown = false;

/**
 * Прекращает приём соединений, дожидается обработки запросов и закрывает Prisma.
 * Повторный сигнал игнорируется; через 10 секунд процесс завершается принудительно.
 */
async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close(async () => {
    await prisma.$disconnect();
    clearTimeout(timeout);
    process.exit(0);
  });
  server.closeIdleConnections();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
