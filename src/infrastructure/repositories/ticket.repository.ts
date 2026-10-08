import type { TicketQuery } from '../../application/dto';
import type { TicketRepository } from '../../application/contracts/repositories';
import type { ProductDetails, TicketStatus } from '../../domain/models';
import type { Prisma } from '../../generated/prisma/client';
import type { DatabaseClient } from '../database/client';

/** Сохраняет снимки товаров и решения модераторов; переход статуса товара выполняет сервис. */
export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly database: DatabaseClient) {}

  async list(query: TicketQuery) {
    const where = { status: query.status, productId: query.productId };
    const [items, total] = await Promise.all([
      this.database.moderationTicket.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.database.moderationTicket.count({ where }),
    ]);
    return { items, total, limit: query.limit, offset: query.offset };
  }

  findById(id: string) {
    return this.database.moderationTicket.findUnique({ where: { id } });
  }

  /** Сериализует переданный товар в JSON-снимок с ISO-датами и сохраняет новую заявку. */
  create(product: ProductDetails) {
    const snapshot = JSON.parse(JSON.stringify(product)) as Prisma.InputJsonValue;
    return this.database.moderationTicket.create({ data: { productId: product.id, snapshot } });
  }

  decide(
    id: string,
    moderatorId: string,
    status: Exclude<TicketStatus, 'PENDING'>,
    reason: string | null,
  ) {
    return this.database.moderationTicket.update({
      where: { id },
      data: { status, reason, moderatorId, decidedAt: new Date() },
    });
  }
}
