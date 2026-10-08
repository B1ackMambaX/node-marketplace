import type { CartRepository } from '../../application/contracts/repositories';
import type { DatabaseClient } from '../database/client';
import { cartRelations } from './selections';

/** Хранит позиции корзины в PostgreSQL; изменение количества не резервирует склад. */
export class PrismaCartRepository implements CartRepository {
  constructor(private readonly database: DatabaseClient) {}

  list(buyerId: string) {
    return this.database.cartItem.findMany({
      where: { buyerId },
      include: cartRelations,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  findItem(buyerId: string, skuId: string) {
    return this.database.cartItem.findUnique({ where: { buyerId_skuId: { buyerId, skuId } } });
  }

  count(buyerId: string) {
    return this.database.cartItem.count({ where: { buyerId } });
  }

  setQuantity(buyerId: string, skuId: string, quantity: number) {
    return this.database.cartItem.upsert({
      where: { buyerId_skuId: { buyerId, skuId } },
      create: { buyerId, skuId, quantity },
      update: { quantity },
    });
  }

  async removeItem(buyerId: string, skuId: string): Promise<void> {
    await this.database.cartItem.deleteMany({ where: { buyerId, skuId } });
  }

  async clear(buyerId: string): Promise<void> {
    await this.database.cartItem.deleteMany({ where: { buyerId } });
  }

  async removeItems(buyerId: string, ids: string[]): Promise<void> {
    await this.database.cartItem.deleteMany({ where: { buyerId, id: { in: ids } } });
  }
}
