import { Router } from 'express';
import type { ApplicationServices } from '../../application/services';
import { AuthController } from '../controllers/auth.controller';
import { CartController } from '../controllers/cart.controller';
import { CatalogController } from '../controllers/catalog.controller';
import { CategoryController } from '../controllers/category.controller';
import { ModerationController } from '../controllers/moderation.controller';
import { OrderController } from '../controllers/order.controller';
import { ProductController } from '../controllers/product.controller';
import { SkuController } from '../controllers/sku.controller';
import { createAuthentication } from '../middleware/authentication';
import { createAuthRoutes } from './auth.routes';
import { createCartRoutes } from './cart.routes';
import { createCatalogRoutes } from './catalog.routes';
import { createCategoryRoutes } from './category.routes';
import { createModerationRoutes } from './moderation.routes';
import { createAdminOrderRoutes, createOrderRoutes } from './order.routes';
import { createSellerRoutes } from './seller.routes';

/** Создаёт контроллеры из сервисов и объединяет маршруты; префикс /api/v1 задаётся в HTTP-приложении. */
export function createApiRoutes(services: ApplicationServices) {
  const router = Router();
  const authenticate = createAuthentication(services.auth);
  const orders = new OrderController(services.orders);

  router.use(createAuthRoutes(new AuthController(services.auth), authenticate));
  router.use(
    '/categories',
    createCategoryRoutes(new CategoryController(services.categories), authenticate),
  );
  router.use(
    '/seller',
    createSellerRoutes(
      new ProductController(services.products),
      new SkuController(services.skus),
      authenticate,
    ),
  );
  router.use(
    '/moderation',
    createModerationRoutes(new ModerationController(services.moderation), authenticate),
  );
  router.use('/catalog', createCatalogRoutes(new CatalogController(services.catalog)));
  router.use('/cart', createCartRoutes(new CartController(services.cart), authenticate));
  router.use('/orders', createOrderRoutes(orders, authenticate));
  router.use('/admin/orders', createAdminOrderRoutes(orders, authenticate));
  return router;
}
