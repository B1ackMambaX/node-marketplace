import type { CreateSkuInput, UpdateSkuInput } from '../../application/dto';
import type { SkuRepository } from '../../application/contracts/repositories';
import type { DatabaseClient } from '../database/client';

/** Хранит варианты товара с остатками; мягкое удаление сохраняет историю заказов. */
export class PrismaSkuRepository implements SkuRepository {
  constructor(private readonly database: DatabaseClient) {}

  findById(id: string) {
    return this.database.sku.findFirst({
      where: { id, deletedAt: null },
      include: { product: true, inventory: true },
    });
  }

  create(productId: string, input: CreateSkuInput) {
    const { quantity, ...fields } = input;
    return this.database.sku.create({
      data: { ...fields, productId, inventory: { create: { quantity } } },
      include: { inventory: true },
    });
  }

  update(id: string, input: Omit<UpdateSkuInput, 'quantity'>) {
    return this.database.sku.update({ where: { id }, data: input, include: { inventory: true } });
  }

  async softDelete(id: string): Promise<void> {
    await this.database.sku.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
