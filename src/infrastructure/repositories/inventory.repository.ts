import type { InventoryRepository } from '../../application/contracts/repositories';
import type { DatabaseClient } from '../database/client';

/** Атомарно меняет склад и резерв через условные UPDATE, возвращая факт изменения записи. */
export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly database: DatabaseClient) {}

  async setQuantity(skuId: string, quantity: number): Promise<void> {
    await this.database.inventory.update({ where: { skuId }, data: { quantity } });
  }

  /** Увеличивает резерв только при совпадении прочитанного резерва и достаточном физическом остатке. */
  async reserve(skuId: string, quantity: number, observedReserved: number): Promise<boolean> {
    const result = await this.database.inventory.updateMany({
      where: { skuId, reserved: observedReserved, quantity: { gte: observedReserved + quantity } },
      data: { reserved: { increment: quantity } },
    });
    return result.count === 1;
  }

  /** Уменьшает резерв без списания склада; возвращает false, если защищённый UPDATE не изменил запись. */
  async release(skuId: string, quantity: number): Promise<boolean> {
    const result = await this.database.inventory.updateMany({
      where: { skuId, reserved: { gte: quantity } },
      data: { reserved: { decrement: quantity } },
    });
    return result.count === 1;
  }

  /** Одним UPDATE уменьшает резерв и физический остаток при достаточном количестве обоих. */
  async fulfill(skuId: string, quantity: number): Promise<boolean> {
    const result = await this.database.inventory.updateMany({
      where: { skuId, reserved: { gte: quantity }, quantity: { gte: quantity } },
      data: { reserved: { decrement: quantity }, quantity: { decrement: quantity } },
    });
    return result.count === 1;
  }
}
