import { describe, expect, mock, test } from 'bun:test';
import { AuthService } from '../src/application/services/auth.service';
import { CartService } from '../src/application/services/cart.service';
import { CatalogService } from '../src/application/services/catalog.service';
import { ModerationService } from '../src/application/services/moderation.service';
import { OrderService } from '../src/application/services/order.service';
import { ProductService } from '../src/application/services/product.service';
import { SkuService } from '../src/application/services/sku.service';
import type { CreateOrderInput } from '../src/application/dto';
import { ApplicationError } from '../src/domain/errors';
import type { ModerationTicket } from '../src/domain/models';
import { address, buyer, cartEntry, hasher, now, order, product } from './helpers/fixtures';
import { TestUnitOfWork } from './helpers/unit-of-work';

async function expectCode(operation: Promise<unknown>, code: string) {
  try {
    await operation;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(ApplicationError);
    expect((error as ApplicationError).code).toBe(code);
  }
}

describe('Сервисы товаров и SKU', () => {
  test('не раскрывает товар другого продавца', async () => {
    const findOwned = mock(async () => null);
    const unitOfWork = new TestUnitOfWork({ products: { findOwned } });
    await expectCode(
      new ProductService(unitOfWork).get('other-seller', 'product'),
      'PRODUCT_NOT_FOUND',
    );
    expect(findOwned).toHaveBeenCalledWith('product', 'other-seller');
  });

  test('проверка модерации запрещает изменение контента до обращения к записи', async () => {
    const unitOfWork = new TestUnitOfWork({
      products: { findOwned: async () => product({ status: 'PENDING' }) },
    });
    await expectCode(
      new ProductService(unitOfWork).update('seller', 'product', { name: 'Новое имя' }),
      'PRODUCT_IN_REVIEW',
    );
  });

  test('изменение цены не сбрасывает остаток, характеристики и одобрение', async () => {
    const entry = cartEntry();
    const update = mock(async () => entry.sku);
    const unitOfWork = new TestUnitOfWork({
      products: { findOwned: async () => product() },
      skus: { update },
    });
    await new SkuService(unitOfWork).update('seller', 'product', 'sku', { price: 20000 });
    expect(update).toHaveBeenCalledWith('sku', { price: 20000 });
    expect(unitOfWork.transactions).toBe(1);
  });

  test('изменение характеристик снимает одобрение товара', async () => {
    const setStatus = mock(async () => {});
    const unitOfWork = new TestUnitOfWork({
      products: { findOwned: async () => product(), setStatus },
      skus: { update: async () => cartEntry().sku },
    });
    await new SkuService(unitOfWork).update('seller', 'product', 'sku', {
      attributes: { color: 'red' },
    });
    expect(setStatus).toHaveBeenCalledWith('product', 'DRAFT');
  });

  test('запрещает остаток ниже резерва', async () => {
    const details = product();
    const sku = details.skus[0];
    if (!sku || !sku.inventory) throw new Error('Fixture requires inventory');
    sku.inventory.reserved = 3;
    const unitOfWork = new TestUnitOfWork({ products: { findOwned: async () => details } });
    await expectCode(
      new SkuService(unitOfWork).update('seller', 'product', 'sku', { quantity: 2 }),
      'STOCK_BELOW_RESERVED',
    );
  });

  test('нельзя отправить товар без SKU', async () => {
    const unitOfWork = new TestUnitOfWork({
      products: { findOwned: async () => product({ status: 'DRAFT', skus: [] }) },
    });
    await expectCode(new ProductService(unitOfWork).submit('seller', 'product'), 'SKU_REQUIRED');
  });
});

describe('Каталог, модерация и корзина', () => {
  const ticket: ModerationTicket = {
    id: 'ticket',
    productId: 'product',
    moderatorId: null,
    status: 'PENDING',
    snapshot: {},
    reason: null,
    createdAt: now,
    decidedAt: null,
  };

  test('решение модерации и статус товара используют одну транзакцию', async () => {
    const setStatus = mock(async () => {});
    const decide = mock(async () => ({ ...ticket, status: 'APPROVED' as const }));
    const unitOfWork = new TestUnitOfWork({
      products: { findById: async () => product({ status: 'PENDING' }), setStatus },
      tickets: { findById: async () => ticket, decide },
    });
    await new ModerationService(unitOfWork).approve('moderator', 'ticket');
    expect(setStatus).toHaveBeenCalledWith('product', 'APPROVED');
    expect(decide).toHaveBeenCalledWith('ticket', 'moderator', 'APPROVED', null);
    expect(unitOfWork.transactions).toBe(1);
  });

  test('повторное решение запрещено до изменения статуса товара', async () => {
    const unitOfWork = new TestUnitOfWork({
      products: { findById: async () => product() },
      tickets: { findById: async () => ({ ...ticket, status: 'APPROVED' }) },
    });
    await expectCode(
      new ModerationService(unitOfWork).approve('moderator', 'ticket'),
      'INVALID_TICKET_STATUS',
    );
  });

  test('публичный каталог скрывает себестоимость и резерв', async () => {
    const unitOfWork = new TestUnitOfWork({
      catalog: {
        findById: async () => ({ ...product(), seller: { id: 'seller', name: 'Seller' } }),
      },
    });
    const result = await new CatalogService(unitOfWork).get('product');
    expect(result.skus[0]).not.toHaveProperty('costPrice');
    expect(result.skus[0]).not.toHaveProperty('inventory');
    expect(result.skus[0]?.availableQuantity).toBe(10);
  });

  test('добавление в корзину суммирует количество и не резервирует остаток', async () => {
    const entry = cartEntry(4);
    const setQuantity = mock(async () => ({ ...entry, quantity: 7 }));
    const unitOfWork = new TestUnitOfWork({
      cart: { findItem: async () => entry, setQuantity },
      skus: { findById: async () => entry.sku },
    });
    expect(await new CartService(unitOfWork).add('buyer', 'sku', 3)).toEqual({
      skuId: 'sku',
      quantity: 7,
    });
    expect(setQuantity).toHaveBeenCalledWith('buyer', 'sku', 7);
  });

  test('скрытый товар нельзя добавить в корзину', async () => {
    const entry = cartEntry();
    entry.sku.product.status = 'DRAFT';
    const unitOfWork = new TestUnitOfWork({
      cart: { findItem: async () => null, count: async () => 0 },
      skus: { findById: async () => entry.sku },
    });
    await expectCode(new CartService(unitOfWork).add('buyer', 'sku', 1), 'SKU_UNAVAILABLE');
  });
});

describe('Заказы без зависимости от Prisma', () => {
  test('повтор ключа возвращает заказ без повторного резервирования и очистки корзины', async () => {
    const unitOfWork = new TestUnitOfWork({ orders: { findByKey: async () => order() } });
    const result = await new OrderService(unitOfWork, hasher).checkout('buyer', 'key', address);
    expect(result.created).toBe(false);
    expect(result.order.id).toBe('order');
    expect(result.order).not.toHaveProperty('requestHash');
    expect(result.order).not.toHaveProperty('idempotencyKey');
  });

  test('другой адрес с тем же ключом вызывает конфликт', async () => {
    const unitOfWork = new TestUnitOfWork({ orders: { findByKey: async () => order() } });
    await expectCode(
      new OrderService(unitOfWork, hasher).checkout('buyer', 'key', 'Другой адрес'),
      'IDEMPOTENCY_CONFLICT',
    );
  });

  test('оформление координирует резерв, снимок цены и очистку в одной транзакции', async () => {
    const entry = cartEntry();
    const reserve = mock(async () => true);
    const create = mock(async (input: CreateOrderInput) => ({ ...order(), ...input }));
    const removeItems = mock(async () => {});
    const unitOfWork = new TestUnitOfWork({
      orders: { findByKey: async () => null, create },
      cart: { list: async () => [entry], removeItems },
      inventory: { reserve },
    });
    const result = await new OrderService(unitOfWork, hasher).checkout('buyer', 'key', address);
    expect(result.created).toBe(true);
    expect(result.order.total).toBe(20000);
    expect(result.order.items[0]?.unitPrice).toBe(10000);
    expect(reserve).toHaveBeenCalledWith('sku', 2, 0);
    expect(removeItems).toHaveBeenCalledWith('buyer', ['cart-item']);
    expect(unitOfWork.transactions).toBe(1);
  });

  test('если товар недоступен, заказ не создаётся и корзина не очищается', async () => {
    const entry = cartEntry();
    entry.sku.product.status = 'DRAFT';
    const unitOfWork = new TestUnitOfWork({
      orders: { findByKey: async () => null },
      cart: { list: async () => [entry] },
    });
    await expectCode(
      new OrderService(unitOfWork, hasher).checkout('buyer', 'key', address),
      'SKU_UNAVAILABLE',
    );
  });

  test('повторная отмена не меняет резерв', async () => {
    const unitOfWork = new TestUnitOfWork({
      orders: { findById: async () => order({ status: 'CANCELLED' }) },
    });
    expect((await new OrderService(unitOfWork, hasher).cancel('buyer', 'order')).status).toBe(
      'CANCELLED',
    );
  });

  test('завершение списывает товар через fulfillment, а не отмену', async () => {
    const fulfill = mock(async () => true);
    const setStatus = mock(async () => order({ status: 'COMPLETED' }));
    const unitOfWork = new TestUnitOfWork({
      orders: { findById: async () => order({ status: 'PROCESSING' }), setStatus },
      inventory: { fulfill },
    });
    await new OrderService(unitOfWork, hasher).process('order', 'COMPLETED');
    expect(fulfill).toHaveBeenCalledWith('sku', 2);
    expect(setStatus).toHaveBeenCalledWith('order', 'COMPLETED');
  });
});

describe('Авторизация с подменяемыми security-адаптерами', () => {
  const passwords = {
    hash: async (value: string) => `password:${value}`,
    verify: async () => true,
  };
  const tokens = {
    ...hasher,
    createAccess: async () => 'access',
    verifyAccess: async () => buyer.id,
    createRefresh: () => 'refresh',
  };
  const clock = { now: () => now };

  test('регистрация хранит хеш и создаёт сессию в одной транзакции', async () => {
    const createUser = mock(async () => buyer);
    const createSession = mock(async () => {});
    const unitOfWork = new TestUnitOfWork({
      users: { create: createUser },
      sessions: { create: createSession },
    });
    const result = await new AuthService(unitOfWork, passwords, tokens, clock).register({
      email: buyer.email,
      name: buyer.name,
      password: 'secret',
      role: 'BUYER',
    });
    expect(createUser).toHaveBeenCalledWith({
      email: buyer.email,
      name: buyer.name,
      passwordHash: 'password:secret',
      role: 'BUYER',
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(createSession).toHaveBeenCalledWith(
      'buyer',
      'hash:refresh',
      new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    );
    expect(unitOfWork.transactions).toBe(1);
  });

  test('истёкший refresh не создаёт новую сессию', async () => {
    const unitOfWork = new TestUnitOfWork({
      sessions: {
        findByHash: async () => ({
          id: 'session',
          userId: 'buyer',
          tokenHash: 'hash:refresh',
          expiresAt: new Date(now.getTime() - 1),
          createdAt: now,
        }),
      },
    });
    await expectCode(
      new AuthService(unitOfWork, passwords, tokens, clock).refresh('refresh'),
      'INVALID_REFRESH_TOKEN',
    );
  });

  test('роль берётся из актуального профиля БД', async () => {
    const unitOfWork = new TestUnitOfWork({
      users: { findById: async () => ({ ...buyer, role: 'ADMIN' }) },
    });
    const result = await new AuthService(unitOfWork, passwords, tokens, clock).authenticate(
      'access',
    );
    expect(result.role).toBe('ADMIN');
  });
});
