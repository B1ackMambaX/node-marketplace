import type { RequestHandler } from 'express';
import type { ReadinessProbe } from '../../application/contracts/readiness';

/** Отдаёт состояние HTTP-процесса и готовность инфраструктуры. */
export class SystemController {
  constructor(private readonly readiness: ReadinessProbe) {}

  /** Подтверждает работу HTTP-процесса без обращения к базе данных. */
  health: RequestHandler = (_request, response) => {
    response.json({ status: 'ok' });
  };

  /** Возвращает ready при доступной БД или 503 с кодом DATABASE_UNAVAILABLE. */
  ready: RequestHandler = async (_request, response) => {
    if (await this.readiness.isReady()) {
      response.json({ status: 'ready' });
    } else {
      response
        .status(503)
        .json({ code: 'DATABASE_UNAVAILABLE', message: 'База данных недоступна' });
    }
  };
}
