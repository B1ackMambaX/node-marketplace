import type { Repositories } from '../../application/contracts/repositories';
import type { DatabaseClient } from '../database/client';
import { PrismaCartRepository } from './cart.repository';
import { PrismaCatalogRepository } from './catalog.repository';
import { PrismaCategoryRepository } from './category.repository';
import { PrismaInventoryRepository } from './inventory.repository';
import { PrismaOrderRepository } from './order.repository';
import { PrismaProductRepository } from './product.repository';
import { PrismaSessionRepository } from './session.repository';
import { PrismaSkuRepository } from './sku.repository';
import { PrismaTicketRepository } from './ticket.repository';
import { PrismaUserRepository } from './user.repository';

/** Создаёт все репозитории на одном переданном клиенте, сохраняя общую транзакцию. */
export function createRepositories(database: DatabaseClient): Repositories {
  return {
    users: new PrismaUserRepository(database),
    sessions: new PrismaSessionRepository(database),
    categories: new PrismaCategoryRepository(database),
    products: new PrismaProductRepository(database),
    skus: new PrismaSkuRepository(database),
    inventory: new PrismaInventoryRepository(database),
    tickets: new PrismaTicketRepository(database),
    catalog: new PrismaCatalogRepository(database),
    cart: new PrismaCartRepository(database),
    orders: new PrismaOrderRepository(database),
  };
}
