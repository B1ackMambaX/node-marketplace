import type { CreateOrderInput, OrderQuery } from '../../application/dto';
import type { OrderRepository } from '../../application/contracts/repositories';
import type { OrderStatus } from '../../domain/models';
import type { DatabaseClient } from '../database/client';
import { orderSelection } from './selections';

/** Сохраняет заказы со снимками позиций и внутренними данными идемпотентности. */
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly database: DatabaseClient) {}

  async list(query: OrderQuery, buyerId?: string) {
    const where = { buyerId, status: query.status };
    const [items, total] = await Promise.all([
      this.database.order.findMany({
        where,
        select: orderSelection,
        take: query.limit,
        skip: query.offset,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.database.order.count({ where }),
    ]);
    return { items, total, limit: query.limit, offset: query.offset };
  }

  findById(id: string, buyerId?: string) {
    return this.database.order.findFirst({ where: { id, buyerId }, select: orderSelection });
  }

  findByKey(buyerId: string, idempotencyKey: string) {
    return this.database.order.findUnique({
      where: { buyerId_idempotencyKey: { buyerId, idempotencyKey } },
      select: orderSelection,
    });
  }

  create(input: CreateOrderInput) {
    const { items, ...fields } = input;
    return this.database.order.create({
      data: { ...fields, items: { create: items } },
      select: orderSelection,
    });
  }

  setStatus(id: string, status: OrderStatus) {
    return this.database.order.update({ where: { id }, data: { status }, select: orderSelection });
  }
}
