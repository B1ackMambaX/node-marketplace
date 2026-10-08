import { Router, type RequestHandler } from 'express';
import type { CartController } from '../controllers/cart.controller';
import { allowRoles } from '../middleware/authentication';

/** Регистрирует маршруты корзины относительно /cart с аутентификацией и ролью BUYER. */
export function createCartRoutes(controller: CartController, authenticate: RequestHandler) {
  const router = Router();
  router.use(authenticate, allowRoles('BUYER'));
  router.get('/', controller.get);
  router.delete('/', controller.clear);
  router.post('/items', controller.add);
  router.patch('/items/:skuId', controller.update);
  router.delete('/items/:skuId', controller.remove);
  return router;
}
