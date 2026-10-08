/** Настраивает Prisma CLI: путь схемы, миграции, seed и подключение из DATABASE_URL. */
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'bun prisma/seed.ts' },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/marketplace',
  },
});
