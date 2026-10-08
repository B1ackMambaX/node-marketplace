import type { Order, StoredOrder } from '../../domain/models';

/** Выбирает поля ответа заказа, исключая ключ идемпотентности и хеш запроса. */
export function toOrder(order: StoredOrder): Order {
  return {
    id: order.id,
    buyerId: order.buyerId,
    status: order.status,
    total: order.total,
    deliveryAddress: order.deliveryAddress,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items,
  };
}
