import type { RequestHandler } from 'express';
import type { SkuService } from '../../application/services/sku.service';
import { currentUser, pathId } from '../request';
import { skuCreate, skuPatch } from '../schemas/product.schema';

/** Разбирает запросы вариантов товара и передаёт владельца и UUID в SkuService. */
export class SkuController {
  constructor(private readonly skus: SkuService) {}

  /** Возвращает SKU товара текущего продавца. */
  list: RequestHandler = async (request, response) => {
    response.json(await this.skus.list(currentUser(request).id, pathId(request)));
  };

  /** Проверяет данные SKU и возвращает созданный вариант со статусом 201. */
  create: RequestHandler = async (request, response) => {
    const input = skuCreate.parse(request.body);
    response
      .status(201)
      .json(await this.skus.create(currentUser(request).id, pathId(request), input));
  };

  /** Проверяет UUID товара и SKU и непустой PATCH варианта. */
  update: RequestHandler = async (request, response) => {
    const input = skuPatch.parse(request.body);
    response.json(
      await this.skus.update(
        currentUser(request).id,
        pathId(request),
        pathId(request, 'skuId'),
        input,
      ),
    );
  };

  /** Запрашивает мягкое удаление SKU и возвращает 204. */
  delete: RequestHandler = async (request, response) => {
    await this.skus.delete(currentUser(request).id, pathId(request), pathId(request, 'skuId'));
    response.sendStatus(204);
  };
}
