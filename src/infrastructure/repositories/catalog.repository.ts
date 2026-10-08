import { Prisma } from '../../generated/prisma/client';
import type { CatalogQuery } from '../../application/dto';
import type { CatalogRepository } from '../../application/contracts/repositories';
import type { CatalogProduct } from '../../domain/models';
import type { DatabaseClient } from '../database/client';
import { catalogRelations } from './selections';

/** Выбирает опубликованные товары для каталога и реализует сортировку по минимальной цене SKU. */
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly database: DatabaseClient) {}

  /**
   * Фильтрует товары по наличию SKU в диапазоне цены, а сортирует по минимуму всех активных SKU.
   * SQL использует связанные параметры; пользовательские %, _ и обратный слеш экранируются в поиске.
   */
  async list(query: CatalogQuery) {
    const { limit, offset, search, categoryId, minPrice, maxPrice, sort } = query;
    const escapedSearch = search?.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.ProductWhereInput = {
      status: 'APPROVED',
      deletedAt: null,
      ...(categoryId ? { categoryId } : {}),
      ...(search ? { name: { contains: escapedSearch, mode: 'insensitive' } } : {}),
      skus: { some: { deletedAt: null, price: { gte: minPrice, lte: maxPrice } } },
    };
    let items: CatalogProduct[];
    if (sort === 'priceAsc' || sort === 'priceDesc') {
      // Prisma doesn't support ordering a parent by MIN(child.price).
      // Only the direction is a fixed SQL fragment; all user values are bound parameters.
      const direction = sort === 'priceAsc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
      const rows = await this.database.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT p.id FROM "Product" p
      JOIN "Sku" s ON s."productId" = p.id AND s."deletedAt" IS NULL
      WHERE p.status = 'APPROVED' AND p."deletedAt" IS NULL
        ${categoryId ? Prisma.sql`AND p."categoryId" = ${categoryId}::uuid` : Prisma.empty}
        ${search ? Prisma.sql`AND p.name ILIKE ${`%${escapedSearch}%`}` : Prisma.empty}
        AND EXISTS (SELECT 1 FROM "Sku" f WHERE f."productId" = p.id AND f."deletedAt" IS NULL
          ${minPrice !== undefined ? Prisma.sql`AND f.price >= ${minPrice}` : Prisma.empty}
          ${maxPrice !== undefined ? Prisma.sql`AND f.price <= ${maxPrice}` : Prisma.empty})
      GROUP BY p.id ORDER BY MIN(s.price) ${direction}, p.id ASC LIMIT ${limit} OFFSET ${offset}
    `);
      const products = await this.database.product.findMany({
        where: { ...where, id: { in: rows.map((row) => row.id) } },
        include: catalogRelations,
      });
      const byId = new Map(products.map((product) => [product.id, product]));
      items = rows.flatMap((row) => {
        const product = byId.get(row.id);
        return product ? [product] : [];
      });
    } else {
      const products = await this.database.product.findMany({
        where,
        include: catalogRelations,
        take: limit,
        skip: offset,
        orderBy: [{ createdAt: sort === 'newest' ? 'desc' : 'asc' }, { id: 'asc' }],
      });
      items = products;
    }
    return { items, total: await this.database.product.count({ where }), limit, offset };
  }

  findById(id: string) {
    return this.database.product.findFirst({
      where: { id, status: 'APPROVED', deletedAt: null, skus: { some: { deletedAt: null } } },
      include: catalogRelations,
    });
  }
}
