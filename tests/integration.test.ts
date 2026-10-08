import { beforeAll, afterAll, beforeEach, describe, expect, test } from 'bun:test';
import request from 'supertest';
import { resolve } from 'node:path';
import type { PrismaClient } from '../src/generated/prisma/client';

const testUrl = process.env.TEST_DATABASE_URL;
const runId = crypto.randomUUID();
const password = 'Test-password-2026';
let prisma: PrismaClient;
let api: ReturnType<typeof request>;
let categoryId: string;
const users: Record<string, { id: string; token: string; refreshToken: string; email: string }> =
  {};
const userIds: string[] = [];
const bearer = (role: string) => `Bearer ${users[role]!.token}`;
const root = '/api/v1';

function databaseIdentity(value: string) {
  const url = new URL(value);
  return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
}

describe.skipIf(!testUrl)('API с PostgreSQL', () => {
  beforeAll(async () => {
    if (!testUrl || !new URL(testUrl).pathname.toLowerCase().includes('test'))
      throw new Error('TEST_DATABASE_URL must name a dedicated test database');
    if (
      process.env.DATABASE_URL &&
      databaseIdentity(testUrl) === databaseIdentity(process.env.DATABASE_URL)
    )
      throw new Error('Test and application databases must differ');
    process.env.DATABASE_URL = testUrl;
    process.env.JWT_SECRET ??= 'integration-test-secret-with-at-least-32-characters';
    const migrate = Bun.spawn([process.execPath, 'run', 'db:deploy'], {
      cwd: resolve(import.meta.dir, '..'),
      env: process.env,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [exit, stdout, stderr] = await Promise.all([
      migrate.exited,
      new Response(migrate.stdout).text(),
      new Response(migrate.stderr).text(),
    ]);
    if (exit !== 0) throw new Error(`Test migrations failed:\n${stdout}\n${stderr}`);
    prisma = (await import('../src/infrastructure/database/client')).prisma;
    api = request((await import('../src/app')).createApp());
    for (const role of ['buyer', 'buyer2', 'seller', 'seller2']) {
      const email = `${role}-${runId}@test.local`;
      const result = await api
        .post(`${root}/auth/register`)
        .send({ email, password, name: role, role: role.startsWith('seller') ? 'SELLER' : 'BUYER' })
        .expect(201);
      users[role] = {
        id: result.body.user.id,
        token: result.body.accessToken,
        refreshToken: result.body.refreshToken,
        email,
      };
      userIds.push(result.body.user.id);
    }
    const passwordHash = await Bun.password.hash(password);
    for (const role of ['moderator', 'admin'] as const) {
      const email = `${role}-${runId}@test.local`;
      const user = await prisma.user.create({
        data: { email, name: role, passwordHash, role: role === 'admin' ? 'ADMIN' : 'MODERATOR' },
      });
      userIds.push(user.id);
      const result = await api.post(`${root}/auth/login`).send({ email, password }).expect(200);
      users[role] = {
        id: user.id,
        token: result.body.accessToken,
        refreshToken: result.body.refreshToken,
        email,
      };
    }
    const category = await api
      .post(`${root}/categories`)
      .set('Authorization', bearer('admin'))
      .send({ name: `Test ${runId}` })
      .expect(201);
    categoryId = category.body.id;
  }, 60_000);

  beforeEach(async () => {
    if (prisma && userIds.length)
      await prisma.cartItem.deleteMany({ where: { buyerId: { in: userIds } } });
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      const productIds = (
        await prisma.product.findMany({
          where: { sellerId: { in: userIds } },
          select: { id: true },
        })
      ).map((p) => p.id);
      const skuIds = (
        await prisma.sku.findMany({
          where: { productId: { in: productIds } },
          select: { id: true },
        })
      ).map((s) => s.id);
      // Delete only this run's records; never truncate shared tables.
      await prisma.$transaction(async (tx) => {
        await tx.cartItem.deleteMany({ where: { buyerId: { in: userIds } } });
        await tx.order.deleteMany({ where: { buyerId: { in: userIds } } });
        await tx.moderationTicket.deleteMany({ where: { productId: { in: productIds } } });
        await tx.inventory.deleteMany({ where: { skuId: { in: skuIds } } });
        await tx.sku.deleteMany({ where: { id: { in: skuIds } } });
        await tx.product.deleteMany({ where: { id: { in: productIds } } });
        if (categoryId) await tx.category.delete({ where: { id: categoryId } });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  async function product(stock = 10, price = 10000, approved = true) {
    const created = await api
      .post(`${root}/seller/products`)
      .set('Authorization', bearer('seller'))
      .send({
        name: `Товар ${crypto.randomUUID()}`,
        description: 'Тестовый товар',
        categoryId,
        images: ['https://example.com/product.png'],
      })
      .expect(201);
    const productId = created.body.id as string;
    const sku = await api
      .post(`${root}/seller/products/${productId}/skus`)
      .set('Authorization', bearer('seller'))
      .send({
        name: 'Чёрный',
        attributes: { color: 'black' },
        price,
        costPrice: 100,
        quantity: stock,
      })
      .expect(201);
    const skuId = sku.body.id as string;
    let ticketId: string | undefined;
    if (approved) {
      const submitted = await api
        .post(`${root}/seller/products/${productId}/submit`)
        .set('Authorization', bearer('seller'))
        .expect(201);
      ticketId = submitted.body.id;
      await api
        .post(`${root}/moderation/tickets/${ticketId}/approve`)
        .set('Authorization', bearer('moderator'))
        .expect(200);
    }
    return { productId, skuId, ticketId };
  }
  async function add(skuId: string, quantity = 1, role = 'buyer') {
    return api
      .post(`${root}/cart/items`)
      .set('Authorization', bearer(role))
      .send({ skuId, quantity })
      .expect(201);
  }
  function checkout(
    key = crypto.randomUUID(),
    role = 'buyer',
    address = 'Екатеринбург, Ленина, 1',
  ) {
    return api
      .post(`${root}/orders`)
      .set('Authorization', bearer(role))
      .set('Idempotency-Key', key)
      .send({ deliveryAddress: address });
  }
  async function inventory(skuId: string) {
    return prisma.inventory.findUniqueOrThrow({ where: { skuId } });
  }

  test('health, ready и Swagger доступны', async () => {
    await api.get('/health').expect(200);
    await api.get('/ready').expect(200);
    await api.get('/docs/').expect(200);
    const spec = await api.get('/openapi.json').expect(200);
    expect(spec.body.openapi).toBe('3.0.3');
  });

  test('регистрация служебной роли и неизвестные поля запрещены', async () => {
    await api
      .post(`${root}/auth/register`)
      .send({ email: `forbidden-${runId}@test.local`, password, name: 'Admin', role: 'ADMIN' })
      .expect(422);
    await api.get(`${root}/seller/products`).expect(401);
    await api.get(`${root}/seller/products`).set('Authorization', bearer('buyer')).expect(403);
    await api
      .post(`${root}/auth/login`)
      .send({ email: users.buyer!.email, password: 'wrong-password' })
      .expect(401);
    const profile = await api
      .get(`${root}/users/me`)
      .set('Authorization', bearer('buyer'))
      .expect(200);
    expect(profile.body).not.toHaveProperty('passwordHash');
  });

  test('refresh ротируется, logout отзывает refresh', async () => {
    const login = await api
      .post(`${root}/auth/login`)
      .send({ email: users.buyer!.email, password })
      .expect(200);
    const first = login.body.refreshToken;
    const rotated = await api
      .post(`${root}/auth/refresh`)
      .send({ refreshToken: first })
      .expect(200);
    await api.post(`${root}/auth/refresh`).send({ refreshToken: first }).expect(401);
    await api
      .post(`${root}/auth/logout`)
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(204);
    await api
      .post(`${root}/auth/logout`)
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(204);
    await api
      .post(`${root}/auth/refresh`)
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
  });

  test('чужой продавец не читает и не изменяет товар', async () => {
    const { productId, skuId } = await product();
    await api
      .get(`${root}/seller/products/${productId}`)
      .set('Authorization', bearer('seller2'))
      .expect(404);
    await api
      .patch(`${root}/seller/products/${productId}`)
      .set('Authorization', bearer('seller2'))
      .send({ name: 'Чужой' })
      .expect(404);
    await api
      .patch(`${root}/seller/products/${productId}/skus/${skuId}`)
      .set('Authorization', bearer('seller2'))
      .send({ quantity: 0 })
      .expect(404);
  });

  test('модерация: черновик скрыт, PENDING неизменяем, отказ требует причину', async () => {
    const { productId } = await product(10, 10000, false);
    await api.get(`${root}/catalog/products/${productId}`).expect(404);
    const submitted = await api
      .post(`${root}/seller/products/${productId}/submit`)
      .set('Authorization', bearer('seller'))
      .expect(201);
    expect(submitted.body.snapshot.images).toEqual(['https://example.com/product.png']);
    await api
      .patch(`${root}/seller/products/${productId}`)
      .set('Authorization', bearer('seller'))
      .send({ name: 'Изменение' })
      .expect(409);
    await api
      .post(`${root}/moderation/tickets/${submitted.body.id}/reject`)
      .set('Authorization', bearer('moderator'))
      .send({})
      .expect(422);
    await api
      .post(`${root}/moderation/tickets/${submitted.body.id}/reject`)
      .set('Authorization', bearer('moderator'))
      .send({ reason: 'Уточните описание' })
      .expect(200);
    const second = await api
      .post(`${root}/seller/products/${productId}/submit`)
      .set('Authorization', bearer('seller'))
      .expect(201);
    await api
      .post(`${root}/moderation/tickets/${second.body.id}/approve`)
      .set('Authorization', bearer('moderator'))
      .expect(200);
    await api
      .post(`${root}/moderation/tickets/${second.body.id}/approve`)
      .set('Authorization', bearer('moderator'))
      .expect(409);
    await api.get(`${root}/catalog/products/${productId}`).expect(200);
  });

  test('цена не сбрасывает остатки и характеристики; контент требует новой модерации', async () => {
    const { productId, skuId } = await product();
    const sku = await api
      .patch(`${root}/seller/products/${productId}/skus/${skuId}`)
      .set('Authorization', bearer('seller'))
      .send({ price: 12345 })
      .expect(200);
    expect(sku.body.inventory.quantity).toBe(10);
    expect(sku.body.attributes).toEqual({ color: 'black' });
    const publicView = await api.get(`${root}/catalog/products/${productId}`).expect(200);
    expect(publicView.body.skus[0].price).toBe(12345);
    expect(JSON.stringify(publicView.body)).not.toContain('costPrice');
    expect(JSON.stringify(publicView.body)).not.toContain('"reserved"');
    const changed = await api
      .patch(`${root}/seller/products/${productId}`)
      .set('Authorization', bearer('seller'))
      .send({ name: 'Новое имя' })
      .expect(200);
    expect(changed.body.images).toEqual(['https://example.com/product.png']);
    expect(changed.body.status).toBe('DRAFT');
    await api.get(`${root}/catalog/products/${productId}`).expect(404);
  });

  test('каталог поддерживает поиск, фильтрацию, сортировку и пагинацию', async () => {
    const first = await product(2, 1000);
    const second = await product(2, 3000);
    const name = `Поиск ${runId}`;
    for (const { productId } of [first, second]) {
      await api
        .patch(`${root}/seller/products/${productId}`)
        .set('Authorization', bearer('seller'))
        .send({ name })
        .expect(200);
      const submitted = await api
        .post(`${root}/seller/products/${productId}/submit`)
        .set('Authorization', bearer('seller'))
        .expect(201);
      await api
        .post(`${root}/moderation/tickets/${submitted.body.id}/approve`)
        .set('Authorization', bearer('moderator'))
        .expect(200);
    }
    const result = await api
      .get(`${root}/catalog/products`)
      .query({ search: name, categoryId, sort: 'priceDesc', limit: 1 })
      .expect(200);
    expect(result.body.total).toBe(2);
    expect(result.body.items[0].id).toBe(second.productId);
    const filtered = await api
      .get(`${root}/catalog/products`)
      .query({ search: name, minPrice: 2000, maxPrice: 4000 })
      .expect(200);
    expect(filtered.body.items.map((p: { id: string }) => p.id)).toEqual([second.productId]);
    await api.get(`${root}/catalog/products`).query({ minPrice: 4000, maxPrice: 1 }).expect(422);
  });

  test('корзина не резервирует товар; оформление фиксирует актуальную цену', async () => {
    const { productId, skuId } = await product();
    await add(skuId, 2);
    expect((await inventory(skuId)).reserved).toBe(0);
    await api
      .patch(`${root}/seller/products/${productId}/skus/${skuId}`)
      .set('Authorization', bearer('seller'))
      .send({ price: 15000 })
      .expect(200);
    const cart = await api.get(`${root}/cart`).set('Authorization', bearer('buyer')).expect(200);
    expect(cart.body.total).toBe(30000);
    const order = await checkout().expect(201);
    expect(order.body.total).toBe(30000);
    expect((await inventory(skuId)).reserved).toBe(2);
    expect((await inventory(skuId)).quantity).toBe(10);
    expect(
      (await api.get(`${root}/cart`).set('Authorization', bearer('buyer')).expect(200)).body.items,
    ).toHaveLength(0);
    await api
      .patch(`${root}/seller/products/${productId}/skus/${skuId}`)
      .set('Authorization', bearer('seller'))
      .send({ price: 25000 })
      .expect(200);
    const saved = await api
      .get(`${root}/orders/${order.body.id}`)
      .set('Authorization', bearer('buyer'))
      .expect(200);
    expect(saved.body.items[0].unitPrice).toBe(15000);
    await api
      .get(`${root}/orders/${order.body.id}`)
      .set('Authorization', bearer('buyer2'))
      .expect(404);
    await api
      .post(`${root}/orders/${order.body.id}/cancel`)
      .set('Authorization', bearer('buyer2'))
      .expect(404);
  });

  test('повторное оформление не резервирует снова; другой адрес даёт 409', async () => {
    const { skuId } = await product();
    await add(skuId, 2);
    const key = crypto.randomUUID();
    const first = await checkout(key).expect(201);
    const replay = await checkout(key).expect(200);
    expect(replay.body.id).toBe(first.body.id);
    expect((await inventory(skuId)).reserved).toBe(2);
    await checkout(key, 'buyer', 'Екатеринбург, Мира, 1').expect(409);
  });

  test('конкурирующие запросы с одним ключом создают ровно один заказ', async () => {
    const { skuId } = await product(5);
    await add(skuId, 2);
    const key = crypto.randomUUID();
    const responses = await Promise.all([checkout(key), checkout(key)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(responses[0]!.body.id).toBe(responses[1]!.body.id);
    expect((await inventory(skuId)).reserved).toBe(2);
  });

  test('два покупателя не могут купить последнюю единицу одновременно', async () => {
    const { skuId } = await product(1);
    await add(skuId, 1, 'buyer');
    await add(skuId, 1, 'buyer2');
    const results = await Promise.all([
      checkout(crypto.randomUUID(), 'buyer'),
      checkout(crypto.randomUUID(), 'buyer2'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await inventory(skuId)).reserved).toBe(1);
    expect((await inventory(skuId)).quantity).toBe(1);
  });

  test('недоступный товар откатывает весь заказ и сохраняет корзину', async () => {
    const first = await product();
    const second = await product();
    await add(first.skuId);
    await add(second.skuId);
    await api
      .patch(`${root}/seller/products/${second.productId}`)
      .set('Authorization', bearer('seller'))
      .send({ description: 'Изменённое описание' })
      .expect(200);
    await checkout().expect(409);
    expect((await inventory(first.skuId)).reserved).toBe(0);
    expect((await inventory(second.skuId)).reserved).toBe(0);
    expect(
      (await api.get(`${root}/cart`).set('Authorization', bearer('buyer')).expect(200)).body.items,
    ).toHaveLength(2);
  });

  test('снижение остатка после добавления в корзину блокирует оформление', async () => {
    const { productId, skuId } = await product(2);
    await add(skuId, 2);
    await api
      .patch(`${root}/seller/products/${productId}/skus/${skuId}`)
      .set('Authorization', bearer('seller'))
      .send({ quantity: 1 })
      .expect(200);
    await checkout().expect(409);
    expect((await inventory(skuId)).reserved).toBe(0);
  });

  test('отмена освобождает резерв ровно один раз; остаток ниже резерва запрещён', async () => {
    const { productId, skuId } = await product(3);
    await add(skuId, 2);
    const order = await checkout().expect(201);
    await api
      .patch(`${root}/seller/products/${productId}/skus/${skuId}`)
      .set('Authorization', bearer('seller'))
      .send({ quantity: 1 })
      .expect(409);
    await api
      .delete(`${root}/seller/products/${productId}/skus/${skuId}`)
      .set('Authorization', bearer('seller'))
      .expect(409);
    const results = await Promise.all([
      api.post(`${root}/orders/${order.body.id}/cancel`).set('Authorization', bearer('buyer')),
      api.post(`${root}/orders/${order.body.id}/cancel`).set('Authorization', bearer('buyer')),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect((await inventory(skuId)).reserved).toBe(0);
    expect((await inventory(skuId)).quantity).toBe(3);
  });

  test('завершение списывает товар один раз и запрещает отмену', async () => {
    const { skuId } = await product(3);
    await add(skuId, 2);
    const order = await checkout().expect(201);
    const path = `${root}/admin/orders/${order.body.id}/status`;
    await api
      .patch(path)
      .set('Authorization', bearer('buyer'))
      .send({ status: 'PROCESSING' })
      .expect(403);
    await api
      .patch(path)
      .set('Authorization', bearer('admin'))
      .send({ status: 'COMPLETED' })
      .expect(409);
    await api
      .patch(path)
      .set('Authorization', bearer('admin'))
      .send({ status: 'PROCESSING' })
      .expect(200);
    await api
      .patch(path)
      .set('Authorization', bearer('admin'))
      .send({ status: 'COMPLETED' })
      .expect(200);
    await api
      .patch(path)
      .set('Authorization', bearer('admin'))
      .send({ status: 'COMPLETED' })
      .expect(200);
    expect((await inventory(skuId)).quantity).toBe(1);
    expect((await inventory(skuId)).reserved).toBe(0);
    await api
      .post(`${root}/orders/${order.body.id}/cancel`)
      .set('Authorization', bearer('buyer'))
      .expect(409);
  });
});
