import type { Pagination } from '../../application/dto';
import type { CategoryRepository } from '../../application/contracts/repositories';
import type { DatabaseClient } from '../database/client';

/** Читает и сохраняет категории; допустимость удаления проверяет CategoryService. */
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly database: DatabaseClient) {}

  async list(query: Pagination) {
    const [items, total] = await Promise.all([
      this.database.category.findMany({
        take: query.limit,
        skip: query.offset,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.database.category.count(),
    ]);
    return { items, total, ...query };
  }

  findById(id: string) {
    return this.database.category.findUnique({ where: { id } });
  }

  create(name: string) {
    return this.database.category.create({ data: { name } });
  }

  rename(id: string, name: string) {
    return this.database.category.update({ where: { id }, data: { name } });
  }

  async hasProducts(categoryId: string): Promise<boolean> {
    return (await this.database.product.count({ where: { categoryId } })) > 0;
  }

  async delete(id: string): Promise<void> {
    await this.database.category.delete({ where: { id } });
  }
}
