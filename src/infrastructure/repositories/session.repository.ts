import type { SessionRepository } from '../../application/contracts/repositories';
import type { DatabaseClient } from '../database/client';

/** Хранит хеши refresh-токенов и однократно удаляет сессии при ротации. */
export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly database: DatabaseClient) {}

  findByHash(tokenHash: string) {
    return this.database.session.findUnique({ where: { tokenHash } });
  }

  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.database.session.create({ data: { userId, tokenHash, expiresAt } });
  }

  /** Удаляет сессию по ID и хешу; только один потребитель может получить true. */
  async consume(id: string, tokenHash: string): Promise<boolean> {
    const deleted = await this.database.session.deleteMany({ where: { id, tokenHash } });
    return deleted.count === 1;
  }

  async revoke(tokenHash: string): Promise<void> {
    await this.database.session.deleteMany({ where: { tokenHash } });
  }
}
