import { Router, type RequestHandler } from 'express';
import type { OrderController } from '../controllers/order.controller';
import { allowRoles } from '../middleware/authentication';

/** Регистрирует операции заказов покупателя относительно /orders с ролью BUYER. */
export function createOrderRoutes(controller: OrderController, authenticate: RequestHandler) {
  const router = Router();
  router.use(authenticate, allowRoles('BUYER'));
  router.get('/', controller.list);
  router.post('/', controller.checkout);
  router.get('/:id', controller.get);
  router.post('/:id/cancel', controller.cancel);
  return router;
}

/** Регистрирует общий список и смену статуса относительно /admin/orders с ролью ADMIN. */
export function createAdminOrderRoutes(controller: OrderController, authenticate: RequestHandler) {
  const router = Router();
  router.use(authenticate, allowRoles('ADMIN'));
  router.get('/', controller.listAll);
  router.patch('/:id/status', controller.changeStatus);
  return router;
}
