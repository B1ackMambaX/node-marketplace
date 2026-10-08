import type { RequestHandler } from 'express';
import type { ProductService } from '../../application/services/product.service';
import { currentUser, pathId } from '../request';
import { productCreate, productPatch, sellerProductQuerySchema } from '../schemas/product.schema';

/** Разбирает запросы кабинета продавца и передаёт операции с товарами ProductService. */
export class ProductController {
  constructor(private readonly products: ProductService) {}

  /** Возвращает товары текущего продавца по проверенным фильтрам. */
  list: RequestHandler = async (request, response) => {
    const query = sellerProductQuerySchema.parse(request.query);
    response.json(await this.products.list(currentUser(request).id, query));
  };

  /** Проверяет UUID и запрашивает товар текущего продавца. */
  get: RequestHandler = async (request, response) => {
    response.json(await this.products.get(currentUser(request).id, pathId(request)));
  };

  /** Проверяет контент и возвращает созданный черновик со статусом 201. */
  create: RequestHandler = async (request, response) => {
    const input = productCreate.parse(request.body);
    response.status(201).json(await this.products.create(currentUser(request).id, input));
  };

  /** Проверяет непустой PATCH и передаёт только указанные поля товара. */
  update: RequestHandler = async (request, response) => {
    const input = productPatch.parse(request.body);
    response.json(await this.products.update(currentUser(request).id, pathId(request), input));
  };

  /** Запрашивает мягкое удаление товара текущего продавца и возвращает 204. */
  delete: RequestHandler = async (request, response) => {
    await this.products.delete(currentUser(request).id, pathId(request));
    response.sendStatus(204);
  };

  /** Отправляет товар текущего продавца на модерацию и возвращает заявку со статусом 201. */
  submit: RequestHandler = async (request, response) => {
    response.status(201).json(await this.products.submit(currentUser(request).id, pathId(request)));
  };
}
