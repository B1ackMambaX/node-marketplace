import type { RequestHandler } from 'express';
import type { CartService } from '../../application/services/cart.service';
import { currentUser, pathId } from '../request';
import { addCartItemSchema, updateCartItemSchema } from '../schemas/cart.schema';

/** Переводит запросы корзины текущего покупателя в вызовы CartService. */
export class CartController {
  constructor(private readonly cart: CartService) {}

  /** Возвращает представление корзины текущего пользователя. */
  get: RequestHandler = async (request, response) => {
    response.json(await this.cart.get(currentUser(request).id));
  };

  /** Проверяет SKU и количество в теле и возвращает сохранённое количество со статусом 201. */
  add: RequestHandler = async (request, response) => {
    const { skuId, quantity } = addCartItemSchema.parse(request.body);
    response.status(201).json(await this.cart.add(currentUser(request).id, skuId, quantity));
  };

  /** Проверяет UUID и тело, затем устанавливает количество позиции текущего покупателя. */
  update: RequestHandler = async (request, response) => {
    const { quantity } = updateCartItemSchema.parse(request.body);
    response.json(
      await this.cart.update(currentUser(request).id, pathId(request, 'skuId'), quantity),
    );
  };

  /** Удаляет SKU из корзины текущего покупателя и возвращает 204. */
  remove: RequestHandler = async (request, response) => {
    await this.cart.remove(currentUser(request).id, pathId(request, 'skuId'));
    response.sendStatus(204);
  };

  /** Очищает корзину текущего покупателя и возвращает 204. */
  clear: RequestHandler = async (request, response) => {
    await this.cart.clear(currentUser(request).id);
    response.sendStatus(204);
  };
}
