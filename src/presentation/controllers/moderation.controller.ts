import type { RequestHandler } from 'express';
import type { ModerationService } from '../../application/services/moderation.service';
import { currentUser, pathId } from '../request';
import { approveSchema, rejectSchema, ticketQuerySchema } from '../schemas/moderation.schema';

/** Разбирает очередь и решения модерации и передаёт ID текущего модератора сервису. */
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  /** Нормализует фильтры заявок и возвращает страницу очереди или истории. */
  list: RequestHandler = async (request, response) => {
    response.json(await this.moderation.list(ticketQuerySchema.parse(request.query)));
  };

  /** Проверяет UUID и возвращает заявку со снимком товара. */
  get: RequestHandler = async (request, response) => {
    response.json(await this.moderation.get(pathId(request)));
  };

  /** Допускает пустое тело без дополнительных полей и передаёт решение об одобрении. */
  approve: RequestHandler = async (request, response) => {
    approveSchema.parse(request.body ?? {});
    response.json(await this.moderation.approve(currentUser(request).id, pathId(request)));
  };

  /** Проверяет обязательную причину и передаёт решение об отклонении. */
  reject: RequestHandler = async (request, response) => {
    const { reason } = rejectSchema.parse(request.body);
    response.json(await this.moderation.reject(currentUser(request).id, pathId(request), reason));
  };
}
