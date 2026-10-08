import { Router, type RequestHandler } from 'express';
import type { CategoryController } from '../controllers/category.controller';
import { allowRoles } from '../middleware/authentication';

/** Регистрирует публичное чтение категорий и изменение только для ADMIN относительно /categories. */
export function createCategoryRoutes(controller: CategoryController, authenticate: RequestHandler) {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', authenticate, allowRoles('ADMIN'), controller.create);
  router.patch('/:id', authenticate, allowRoles('ADMIN'), controller.rename);
  router.delete('/:id', authenticate, allowRoles('ADMIN'), controller.delete);
  return router;
}
