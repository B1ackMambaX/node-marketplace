import { expect, test } from 'bun:test';
import { openapi } from '../src/presentation/docs/openapi';

test('OpenAPI: все ссылки и параметры пути разрешаются', () => {
  interface Operation {
    parameters?: { name: string; in: string; required?: boolean }[];
    responses: Record<string, { content?: unknown }>;
  }
  const document = JSON.parse(JSON.stringify(openapi)) as {
    components: { schemas: Record<string, unknown> };
    paths: Record<string, Record<string, Operation>>;
  };
  function walk(value: unknown) {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record.$ref === 'string') {
      expect(record.$ref.startsWith('#/components/schemas/')).toBe(true);
      expect(document.components.schemas[record.$ref.split('/').at(-1)!]).toBeDefined();
    }
    for (const item of Object.values(record)) walk(item);
  }
  walk(document);
  for (const [path, methods] of Object.entries(document.paths)) {
    for (const operation of Object.values(methods)) {
      for (const match of path.matchAll(/\{(\w+)\}/g)) {
        expect(
          operation.parameters?.some(
            (parameter) =>
              parameter.name === match[1] && parameter.in === 'path' && parameter.required,
          ),
        ).toBe(true);
      }
      expect(operation.responses).toBeDefined();
      if (operation.responses[204]) expect(operation.responses[204].content).toBeUndefined();
    }
  }
});

test('Публичные схемы не содержат себестоимость, резерв или пароль', () => {
  for (const name of ['PublicProduct', 'PublicSku', 'User', 'Order', 'Cart']) {
    const schema = JSON.stringify(openapi.components.schemas[name]);
    expect(schema).not.toContain('costPrice');
    expect(schema).not.toContain('"reserved"');
    expect(schema).not.toContain('passwordHash');
  }
  expect(
    openapi.paths['/api/v1/orders'].post.parameters?.find(
      (parameter) => parameter.name === 'Idempotency-Key',
    )?.required,
  ).toBe(true);
});

test('Генерация сохраняет необязательные defaults и ограничения PATCH', () => {
  const { Register, ProductInput, ProductPatch, SkuInput, SkuPatch } = openapi.components.schemas;
  expect(Register?.required).toEqual(['email', 'password', 'name']);
  expect(ProductInput?.required).toEqual(['name', 'description', 'categoryId']);
  expect(SkuInput?.required).toEqual(['name', 'price']);
  expect(Register?.properties?.role).toMatchObject({ default: 'BUYER' });
  expect(ProductInput?.properties?.images).toMatchObject({ default: [], maxItems: 10 });
  expect(SkuInput?.properties?.attributes).toMatchObject({ default: {}, maxProperties: 50 });
  for (const patch of [ProductPatch, SkuPatch]) {
    expect(patch?.minProperties).toBe(1);
    expect(patch?.required ?? []).toEqual([]);
    for (const field of Object.values(patch?.properties ?? {})) {
      expect(field).not.toHaveProperty('default');
    }
    expect(patch?.additionalProperties).toBe(false);
  }
});

test('Параметры каталога и модерации сохраняют defaults и границы', () => {
  const catalog = openapi.paths['/api/v1/catalog/products'].get.parameters;
  expect(catalog?.find((parameter) => parameter.name === 'limit')).toMatchObject({
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  });
  expect(catalog?.find((parameter) => parameter.name === 'sort')).toMatchObject({
    required: false,
    schema: { enum: ['newest', 'oldest', 'priceAsc', 'priceDesc'], default: 'newest' },
  });
  expect(
    openapi.paths['/api/v1/moderation/tickets'].get.parameters?.find(
      (parameter) => parameter.name === 'status',
    ),
  ).toMatchObject({ required: false, schema: { default: 'PENDING' } });
  expect(
    openapi.paths['/api/v1/orders'].post.parameters?.find(
      (parameter) => parameter.name === 'Idempotency-Key',
    ),
  ).toMatchObject({
    required: true,
    schema: { minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9_.:-]+$' },
  });
});
