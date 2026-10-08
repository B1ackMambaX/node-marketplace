import type {
  CreateProductInput,
  SellerProductQuery,
  UpdateProductInput,
} from '../../application/dto';
import type { ProductRepository } from '../../application/contracts/repositories';
import type { ProductStatus } from '../../domain/models';
import type { DatabaseClient } from '../database/client';
import { productRelations } from './selections';

/** Хранит товары и выбирает их активные SKU; правила модерации остаются в сервисе. */
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly database: DatabaseClient) {}

  async listOwned(sellerId: string, query: SellerProductQuery) {
    const where = { sellerId, deletedAt: null, status: query.status };
    const [items, total] = await Promise.all([
      this.database.product.findMany({
        where,
        include: productRelations,
        take: query.limit,
        skip: query.offset,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.database.product.count({ where }),
    ]);
    return { items, total, limit: query.limit, offset: query.offset };
  }

  findOwned(id: string, sellerId: string) {
    return this.database.product.findFirst({
      where: { id, sellerId, deletedAt: null },
      include: productRelations,
    });
  }

  findById(id: string) {
    return this.database.product.findUnique({ where: { id }, include: productRelations });
  }

  create(sellerId: string, input: CreateProductInput) {
    return this.database.product.create({
      data: { sellerId, ...input },
      include: productRelations,
    });
  }

  updateContent(id: string, input: UpdateProductInput) {
    return this.database.product.update({ where: { id }, data: input, include: productRelations });
  }

  async setStatus(id: string, status: ProductStatus): Promise<void> {
    await this.database.product.update({ where: { id }, data: { status } });
  }

  async softDelete(id: string): Promise<void> {
    await this.database.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
