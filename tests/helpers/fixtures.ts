import type { CartEntry, ProductDetails, StoredOrder, UserProfile } from '../../src/domain/models';

/** Фиксированный момент времени для воспроизводимых тестовых моделей. */
export const now = new Date('2026-10-07T00:00:00Z');
/** Тестовый профиль покупателя; для изменяемых моделей используйте отдельные объекты. */
export const buyer: UserProfile = {
  id: 'buyer',
  email: 'buyer@test.local',
  name: 'Buyer',
  role: 'BUYER',
  createdAt: now,
};

/** Создаёт независимый одобренный товар с SKU и складом, применяя заданные переопределения. */
export function product(overrides: Partial<ProductDetails> = {}): ProductDetails {
  return {
    id: 'product',
    sellerId: 'seller',
    categoryId: 'category',
    name: 'Товар',
    description: 'Описание',
    images: [],
    status: 'APPROVED',
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    category: { id: 'category', name: 'Категория', createdAt: now, updatedAt: now },
    skus: [
      {
        id: 'sku',
        productId: 'product',
        name: 'Чёрный',
        attributes: { color: 'black' },
        price: 10000,
        costPrice: 100,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        inventory: { skuId: 'sku', quantity: 10, reserved: 0 },
      },
    ],
    ...overrides,
  };
}

/** Создаёт позицию корзины с актуальными данными товара, SKU и заданным количеством. */
export function cartEntry(quantity = 2): CartEntry {
  const details = product();
  const sku = details.skus[0];
  if (!sku) throw new Error('Fixture requires a SKU');
  return {
    id: 'cart-item',
    buyerId: buyer.id,
    skuId: sku.id,
    quantity,
    createdAt: now,
    sku: { ...sku, product: details },
  };
}

/** Детерминированная тестовая подмена хеширования; не подходит для хранения реальных секретов. */
export const hasher = { hash: (value: string) => `hash:${value}` };
/** Адрес тестового оформления, используемый при проверке идемпотентности. */
export const address = 'Екатеринбург, Ленина, 1';

/** Создаёт внутреннюю модель заказа со снимками и согласованным хешем тестового адреса. */
export function order(overrides: Partial<StoredOrder> = {}): StoredOrder {
  return {
    id: 'order',
    buyerId: buyer.id,
    status: 'CREATED',
    total: 20000,
    deliveryAddress: address,
    idempotencyKey: 'key',
    requestHash: hasher.hash(JSON.stringify({ deliveryAddress: address })),
    createdAt: now,
    updatedAt: now,
    items: [
      { skuId: 'sku', productName: 'Товар', skuName: 'Чёрный', unitPrice: 10000, quantity: 2 },
    ],
    ...overrides,
  };
}
