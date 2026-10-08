import { createServices } from './application/services';
import { jwtSecret } from './infrastructure/config/environment';
import { prisma } from './infrastructure/database/client';
import { PostgresReadinessProbe } from './infrastructure/database/readiness';
import { PrismaRepositoryContext } from './infrastructure/database/repository-context';
import { BunPasswordHasher } from './infrastructure/security/password-hasher';
import { JwtTokenProvider } from './infrastructure/security/token-provider';
import type { HttpDependencies } from './presentation/app';

/**
 * Создаёт зависимости HTTP-приложения: сервисы и проверку доступности БД.
 * Выбирает конкретные адаптеры хранения, хеширования паролей и токенов
 * и передаёт их прикладным сервисам.
 */
export function createDependencies(): HttpDependencies {
  const repositoryContext = new PrismaRepositoryContext(prisma);
  const passwords = new BunPasswordHasher();
  const tokens = new JwtTokenProvider(jwtSecret());
  const clock = { now: () => new Date() };

  return {
    services: createServices(repositoryContext, passwords, tokens, clock),
    readiness: new PostgresReadinessProbe(prisma),
  };
}
