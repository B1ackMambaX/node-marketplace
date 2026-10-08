import type { ReadinessProbe } from '../../application/contracts/readiness';
import type { PrismaClient } from '../../generated/prisma/client';

/** Проверяет доступность PostgreSQL коротким запросом SELECT 1. */
export class PostgresReadinessProbe implements ReadinessProbe {
  constructor(private readonly database: PrismaClient) {}

  /** Возвращает false при ошибке запроса; проверка не подтверждает наличие всей схемы приложения. */
  async isReady(): Promise<boolean> {
    try {
      await this.database.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
