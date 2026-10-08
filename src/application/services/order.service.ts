import { ApplicationError, conflict, notFound } from '../../domain/errors';
import type { CartEntry, OrderItem, OrderStatus, StoredOrder } from '../../domain/models';
import { canChangeOrderStatus, orderTotal } from '../../domain/order-rules';
import { ensurePurchasable, ensureStockAvailable } from '../../domain/product-rules';
import { mapPage, type OrderQuery } from '../dto';
import { toOrder } from '../mappers/order.mapper';
import type { Repositories } from '../contracts/repositories';
import type { ValueHasher } from '../contracts/security';
import type { RepositoryContext } from '../contracts/unit-of-work';

/** Оформление и обработка заказов с идемпотентностью, резервом и снимками цен. */
export class OrderService {
  constructor(
    private readonly unitOfWork: RepositoryContext,
    private readonly hasher: ValueHasher,
  ) {}

  /** Возвращает заказы без внутренних полей; без buyerId используется для административного списка. */
  async list(query: OrderQuery, buyerId?: string) {
    const orders = await this.unitOfWork.read((repositories) =>
      repositories.orders.list(query, buyerId),
    );
    return mapPage(orders, toOrder);
  }

  /** Возвращает заказ покупателя; чужой заказ обрабатывается как отсутствующий. */
  async get(buyerId: string, orderId: string) {
    const order = await this.unitOfWork.read((repositories) =>
      repositories.orders.findById(orderId, buyerId),
    );
    if (!order) {
      throw notFound('ORDER_NOT_FOUND', 'Заказ не найден');
    }
    return toOrder(order);
  }

  /**
   * Возвращает исходный заказ при повторе ключа и того же нормализованного адреса.
   * Для новой покупки атомарно резервирует склад, сохраняет снимки и удаляет оформленные позиции.
   * @throws ApplicationError При другом адресе с тем же ключом или невозможности покупки.
   */
  async checkout(buyerId: string, key: string, deliveryAddress: string) {
    const requestHash = this.hasher.hash(JSON.stringify({ deliveryAddress }));
    try {
      return await this.unitOfWork.transaction(async (repositories) => {
        const existing = await repositories.orders.findByKey(buyerId, key);
        if (existing) {
          return this.replay(existing, requestHash);
        }
        const cart = await repositories.cart.list(buyerId);
        if (!cart.length) {
          throw conflict('EMPTY_CART', 'Корзина пуста');
        }
        const items = cart.map(toOrderItem);
        const total = orderTotal(items);
        await this.reserveCart(repositories, cart);
        const order = await repositories.orders.create({
          buyerId,
          total,
          deliveryAddress,
          idempotencyKey: key,
          requestHash,
          items,
        });
        await repositories.cart.removeItems(
          buyerId,
          cart.map((item) => item.id),
        );
        return { order: toOrder(order), created: true };
      });
    } catch (error) {
      // A unique-key conflict can mean another checkout committed the same key.
      if (error instanceof ApplicationError && error.code === 'CONFLICT') {
        const existing = await this.unitOfWork.read((repositories) =>
          repositories.orders.findByKey(buyerId, key),
        );
        if (existing) {
          return this.replay(existing, requestHash);
        }
      }
      throw error;
    }
  }

  /** Отменяет заказ покупателя и освобождает резерв; повтор не меняет остатки. */
  cancel(buyerId: string, orderId: string) {
    return this.changeStatus(orderId, 'CANCELLED', buyerId);
  }

  /** Переводит заказ в обработку или завершает со списанием; допуск администратора проверяет HTTP-слой. */
  process(orderId: string, target: 'PROCESSING' | 'COMPLETED') {
    return this.changeStatus(orderId, target);
  }

  /** Сверяет хеш оформления и возвращает сохранённый заказ с created: false. */
  private replay(order: StoredOrder, requestHash: string) {
    if (order.requestHash !== requestHash) {
      throw conflict('IDEMPOTENCY_CONFLICT', 'Ключ уже использован с другим телом запроса');
    }
    return { order: toOrder(order), created: false };
  }

  /** Проверяет позиции и резервирует их в стабильном порядке SKU внутри текущей транзакции. */
  private async reserveCart(repositories: Repositories, cart: CartEntry[]): Promise<void> {
    // Reserve in a stable order even when the cart display order differs.
    for (const item of [...cart].sort(compareSkuIds)) {
      ensurePurchasable(item.sku);
      ensureStockAvailable(item.sku, item.quantity);
      const reserved = item.sku.inventory?.reserved ?? 0;
      if (!(await repositories.inventory.reserve(item.skuId, item.quantity, reserved))) {
        throw conflict('INSUFFICIENT_STOCK', 'Остатки изменились; повторите запрос');
      }
    }
  }

  /** Проверяет переход и атомарно меняет статус со складскими эффектами; повтор статуса безопасен. */
  private changeStatus(orderId: string, target: OrderStatus, buyerId?: string) {
    return this.unitOfWork.transaction(async (repositories) => {
      const order = await repositories.orders.findById(orderId, buyerId);
      if (!order) {
        throw notFound('ORDER_NOT_FOUND', 'Заказ не найден');
      }
      if (order.status === target) {
        return toOrder(order);
      }
      if (!canChangeOrderStatus(order.status, target)) {
        throw conflict('INVALID_ORDER_STATUS', 'Недопустимый переход статуса заказа');
      }
      if (target === 'CANCELLED' || target === 'COMPLETED') {
        await this.settleInventory(repositories, order.items, target);
      }
      return toOrder(await repositories.orders.setStatus(orderId, target));
    });
  }

  /** При отмене освобождает резерв, при завершении списывает его вместе с физическим остатком. */
  private async settleInventory(
    repositories: Repositories,
    items: OrderItem[],
    target: 'CANCELLED' | 'COMPLETED',
  ): Promise<void> {
    for (const item of [...items].sort(compareSkuIds)) {
      const changed =
        target === 'CANCELLED'
          ? await repositories.inventory.release(item.skuId, item.quantity)
          : await repositories.inventory.fulfill(item.skuId, item.quantity);
      if (!changed) {
        throw conflict('INVENTORY_CONFLICT', 'Некорректное состояние резерва');
      }
    }
  }
}

/** Создаёт снимок названий, текущей цены и количества позиции для сохранения в заказе. */
function toOrderItem(item: CartEntry): OrderItem {
  return {
    skuId: item.skuId,
    productName: item.sku.product.name,
    skuName: item.sku.name,
    unitPrice: item.sku.price,
    quantity: item.quantity,
  };
}

/** Задаёт единый порядок складских операций, уменьшая вероятность взаимных блокировок. */
function compareSkuIds(left: { skuId: string }, right: { skuId: string }): number {
  return left.skuId.localeCompare(right.skuId);
}
