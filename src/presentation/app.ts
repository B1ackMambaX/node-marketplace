import express from 'express';
import swaggerUi from 'swagger-ui-express';
import type { ReadinessProbe } from '../application/contracts/readiness';
import type { ApplicationServices } from '../application/services';
import { SystemController } from './controllers/system.controller';
import { openapi } from './docs/openapi';
import { errorHandler } from './middleware/error-handler';
import { createApiRoutes } from './routes';

/** Готовые сервисы и проверка инфраструктуры, необходимые HTTP-приложению. */
export interface HttpDependencies {
  services: ApplicationServices;
  readiness: ReadinessProbe;
}

/**
 * Собирает Express, маршруты API, Swagger и обработчик ошибок из переданных зависимостей.
 */
export function createHttpApp({ services, readiness }: HttpDependencies) {
  const app = express();
  const system = new SystemController(readiness);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.get('/health', system.health);
  app.get('/ready', system.ready);
  app.get('/openapi.json', (_request, response) => response.json(openapi));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
  app.use('/api/v1', createApiRoutes(services));
  app.use((_request, response) =>
    response.status(404).json({ code: 'NOT_FOUND', message: 'Маршрут не найден' }),
  );
  app.use(errorHandler);
  return app;
}
