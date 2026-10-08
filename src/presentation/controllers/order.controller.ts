import type { RequestHandler } from 'express';
import type { OrderService } from '../../application/services/order.service';
import { currentUser, pathId } from '../request';
import {
  checkoutSchema,
  idempotencyKeySchema,
  orderQuerySchema,
  orderStatusSchema,
} from '../schemas/order.schema';

/** Обрабатывает оформление, чтение и смену статусов заказов через OrderService. */
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  /** Возвращает страницу заказов только текущего покупателя. */
  list: RequestHandler = async (request, response) => {
    response.json(
      await this.orders.list(orderQuerySchema.parse(request.query), currentUser(request).id),
    );
  };

  /** Проверяет UUID и запрашивает заказ с ограничением текущим покупателем. */
  get: RequestHandler = async (request, response) => {
    response.json(await this.orders.get(currentUser(request).id, pathId(request)));
  };

  /** Проверяет адрес и Idempotency-Key; возвращает 201 для нового заказа или 200 для повтора. */
  checkout: RequestHandler = async (request, response) => {
    const { deliveryAddress } = checkoutSchema.parse(request.body);
    const key = idempotencyKeySchema.parse(request.get('Idempotency-Key'));
    const result = await this.orders.checkout(currentUser(request).id, key, deliveryAddress);
    response.status(result.created ? 201 : 200).json(result.order);
  };

  /** Передаёт сервису ID заказа и текущего покупателя для отмены. */
  cancel: RequestHandler = async (request, response) => {
    response.json(await this.orders.cancel(currentUser(request).id, pathId(request)));
  };

  /** Возвращает административный список заказов; роль проверяется маршрутом. */
  listAll: RequestHandler = async (request, response) => {
    response.json(await this.orders.list(orderQuerySchema.parse(request.query)));
  };

  /** Проверяет целевой PROCESSING или COMPLETED и передаёт его сервису. */
  changeStatus: RequestHandler = async (request, response) => {
    const { status } = orderStatusSchema.parse(request.body);
    response.json(await this.orders.process(pathId(request), status));
  };
}
