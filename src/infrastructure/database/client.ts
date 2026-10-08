import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../../generated/prisma/client';
import { databaseUrl } from '../config/environment';

/** Общий Prisma Client с PostgreSQL-адаптером; жизненным циклом соединений управляет server.ts. */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl() }),
});

/** Клиент, достаточный репозиториям: обычный Prisma Client или клиент текущей транзакции. */
export type DatabaseClient = Prisma.TransactionClient;
