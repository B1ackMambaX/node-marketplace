import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import type { Repositories } from '../../application/contracts/repositories';
import type { RepositoryContext } from '../../application/contracts/unit-of-work';
import { createRepositories } from '../repositories';
import { translateDatabaseError } from './errors';

const MAX_TRANSACTION_RETRIES = 3;
const TRANSACTION_TIMEOUT_MS = 10000;

/**
 * Предоставляет репозитории на одном Prisma Client или клиенте общей транзакции.
 * Переводит известные ошибки БД и повторяет конфликты сериализации.
 */
export class PrismaRepositoryContext implements RepositoryContext {
  constructor(private readonly client: PrismaClient) {}

  /** Выполняет callback без общей транзакции и переводит известные ошибки Prisma. */
  async read<T>(operation: (repositories: Repositories) => Promise<T>): Promise<T> {
    try {
      return await operation(createRepositories(this.client));
    } catch (error) {
      throw translateDatabaseError(error);
    }
  }

  /**
   * Выполняет callback с изоляцией Serializable и одним клиентом для всех репозиториев.
   * При P2034 делает до трёх повторов после первой попытки; таймаут одной транзакции — 10 секунд.
   * Каждая неуспешная попытка откатывается; внешние действия callback должны учитывать повторы.
   */
  async transaction<T>(operation: (repositories: Repositories) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.client.$transaction(
          (transaction) => operation(createRepositories(transaction)),
          { isolationLevel: 'Serializable', maxWait: 5000, timeout: TRANSACTION_TIMEOUT_MS },
        );
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!retryable || attempt >= MAX_TRANSACTION_RETRIES) {
          throw translateDatabaseError(error);
        }
        await Bun.sleep(10 * (attempt + 1));
      }
    }
  }
}
