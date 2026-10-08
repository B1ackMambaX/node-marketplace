import { Router } from 'express';
import type { CatalogController } from '../controllers/catalog.controller';

/** Регистрирует публичные маршруты списка и карточки относительно /catalog. */
export function createCatalogRoutes(controller: CatalogController) {
  const router = Router();
  router.get('/products', controller.list);
  router.get('/products/:id', controller.get);
  return router;
}
