import { conflict, notFound } from '../../domain/errors';
import type { TicketQuery } from '../dto';
import type { RepositoryContext } from '../contracts/unit-of-work';

/** Рассмотрение заявок с атомарным изменением решения и статуса товара. */
export class ModerationService {
  constructor(private readonly unitOfWork: RepositoryContext) {}

  /** Возвращает очередь или историю по выбранному статусу и товару. */
  list(query: TicketQuery) {
    return this.unitOfWork.read((repositories) => repositories.tickets.list(query));
  }

  /** Возвращает заявку со снимком или ошибку отсутствия. */
  async get(ticketId: string) {
    const ticket = await this.unitOfWork.read((repositories) =>
      repositories.tickets.findById(ticketId),
    );
    if (!ticket) {
      throw notFound('TICKET_NOT_FOUND', 'Заявка не найдена');
    }
    return ticket;
  }

  /** Одобряет ожидающую заявку и публикует товар в одной транзакции. */
  approve(moderatorId: string, ticketId: string) {
    return this.decide(moderatorId, ticketId, 'APPROVED', null);
  }

  /** Отклоняет ожидающую заявку с причиной и меняет статус товара в одной транзакции. */
  reject(moderatorId: string, ticketId: string, reason: string) {
    return this.decide(moderatorId, ticketId, 'REJECTED', reason);
  }

  /** Требует заявку и неархивный товар в PENDING, затем атомарно сохраняет решение. */
  private decide(
    moderatorId: string,
    ticketId: string,
    status: 'APPROVED' | 'REJECTED',
    reason: string | null,
  ) {
    return this.unitOfWork.transaction(async (repositories) => {
      const ticket = await repositories.tickets.findById(ticketId);
      if (!ticket) {
        throw notFound('TICKET_NOT_FOUND', 'Заявка не найдена');
      }
      const product = await repositories.products.findById(ticket.productId);
      if (
        ticket.status !== 'PENDING' ||
        !product ||
        product.status !== 'PENDING' ||
        product.deletedAt
      ) {
        throw conflict(
          'INVALID_TICKET_STATUS',
          'По заявке уже принято решение или товар недоступен',
        );
      }
      await repositories.products.setStatus(product.id, status);
      return repositories.tickets.decide(ticketId, moderatorId, status, reason);
    });
  }
}
