import { Router, type RequestHandler } from 'express';
import type { ProductController } from '../controllers/product.controller';
import type { SkuController } from '../controllers/sku.controller';
import { allowRoles } from '../middleware/authentication';

/** Регистрирует операции товаров и SKU относительно /seller с аутентификацией и ролью SELLER. */
export function createSellerRoutes(
  products: ProductController,
  skus: SkuController,
  authenticate: RequestHandler,
) {
  const router = Router();
  router.use(authenticate, allowRoles('SELLER'));
  router.get('/products', products.list);
  router.post('/products', products.create);
  router.get('/products/:id', products.get);
  router.patch('/products/:id', products.update);
  router.delete('/products/:id', products.delete);
  router.post('/products/:id/submit', products.submit);
  router.get('/products/:id/skus', skus.list);
  router.post('/products/:id/skus', skus.create);
  router.patch('/products/:id/skus/:skuId', skus.update);
  router.delete('/products/:id/skus/:skuId', skus.delete);
  return router;
}
