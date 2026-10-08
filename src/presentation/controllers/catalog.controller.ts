import type { RequestHandler } from 'express';
import type { CatalogService } from '../../application/services/catalog.service';
import { pathId } from '../request';
import { catalogQuerySchema } from '../schemas/catalog.schema';

/** Обрабатывает публичные запросы каталога через CatalogService. */
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Нормализует фильтры и пагинацию и возвращает страницу публичных товаров. */
  list: RequestHandler = async (request, response) => {
    response.json(await this.catalog.list(catalogQuerySchema.parse(request.query)));
  };

  /** Проверяет UUID и возвращает публичную карточку товара. */
  get: RequestHandler = async (request, response) => {
    response.json(await this.catalog.get(pathId(request)));
  };
}
