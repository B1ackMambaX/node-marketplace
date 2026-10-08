import { z } from 'zod';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  updateProfileSchema,
} from '../schemas/auth.schema';
import { addCartItemSchema, updateCartItemSchema } from '../schemas/cart.schema';
import { catalogQuerySchema } from '../schemas/catalog.schema';
import { categorySchema } from '../schemas/category.schema';
import { paginationSchema } from '../schemas/common.schema';
import { rejectSchema, ticketQuerySchema } from '../schemas/moderation.schema';
import {
  checkoutSchema,
  idempotencyKeySchema,
  orderQuerySchema,
  orderStatusSchema,
} from '../schemas/order.schema';
import {
  productCreate,
  productPatch,
  sellerProductQuerySchema,
  skuCreate,
  skuPatch,
} from '../schemas/product.schema';
import {
  errorResponseSchema,
  userResponseSchema,
  tokensResponseSchema,
  categoryResponseSchema,
  inventoryResponseSchema,
  skuResponseSchema,
  productResponseSchema,
  publicSkuResponseSchema,
  publicProductResponseSchema,
  ticketResponseSchema,
  cartItemResponseSchema,
  cartResponseSchema,
  cartChangeResponseSchema,
  orderItemResponseSchema,
  orderResponseSchema,
  pageResponseSchema,
} from '../schemas/responses.schema';

type Schema = z.core.JSONSchema.BaseSchema;
type Parameter = {
  name: string;
  in: 'path' | 'query' | 'header';
  required?: boolean;
  schema: Schema;
  description?: string;
};
type Operation = {
  tags: string[];
  summary: string;
  description?: string;
  security: { bearerAuth: never[] }[];
  parameters?: Parameter[];
  requestBody?: Record<string, unknown>;
  responses: Record<string, unknown>;
};

/** Преобразует Zod-схему в OpenAPI 3.0 с учётом входных defaults или сериализованного ответа. */
function generateSchema(schema: z.ZodType, io: 'input' | 'output'): Schema {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io });
}

const requestSchemas = {
  Register: registerSchema,
  Login: loginSchema,
  Refresh: refreshSchema,
  CategoryInput: categorySchema,
  ProductInput: productCreate,
  ProductPatch: productPatch,
  SkuInput: skuCreate,
  SkuPatch: skuPatch,
  Checkout: checkoutSchema,
};
const responseSchemas = {
  Error: errorResponseSchema,
  User: userResponseSchema,
  Tokens: tokensResponseSchema,
  Category: categoryResponseSchema,
  Inventory: inventoryResponseSchema,
  Sku: skuResponseSchema,
  Product: productResponseSchema,
  PublicSku: publicSkuResponseSchema,
  PublicProduct: publicProductResponseSchema,
  Ticket: ticketResponseSchema,
  CartItem: cartItemResponseSchema,
  Cart: cartResponseSchema,
  CartChange: cartChangeResponseSchema,
  OrderItem: orderItemResponseSchema,
  Order: orderResponseSchema,
};
const schemas = Object.fromEntries([
  ...Object.entries(requestSchemas).map(([name, schema]) => [
    name,
    generateSchema(schema, 'input'),
  ]),
  ...Object.entries(responseSchemas).map(([name, schema]) => [
    name,
    generateSchema(schema, 'output'),
  ]),
]);
const ref = (name: keyof typeof requestSchemas | keyof typeof responseSchemas): Schema => ({
  $ref: `#/components/schemas/${name}`,
});
const list = (name: keyof typeof responseSchemas) =>
  generateSchema(pageResponseSchema(responseSchemas[name]), 'output');
const response = (description: string, schema?: Schema) => ({
  description,
  ...(schema ? { content: { 'application/json': { schema } } } : {}),
});
const body = (schema: Schema) => ({ required: true, content: { 'application/json': { schema } } });

/** Генерирует параметры query из входной Zod-схемы, сохраняя обязательность и ограничения полей. */
function queryParameters(schema: z.ZodType): Parameter[] {
  const generated = generateSchema(schema, 'input');
  return Object.entries(generated.properties ?? {}).map(([name, field]) => {
    if (typeof field === 'boolean') {
      throw new Error(`OpenAPI 3.0 does not support boolean schemas for parameter ${name}`);
    }
    return {
      name,
      in: 'query',
      required: generated.required?.includes(name) ?? false,
      schema: field,
    };
  });
}
const pathId = (name = 'id'): Parameter => ({
  name,
  in: 'path',
  required: true,
  schema: generateSchema(z.uuid(), 'input'),
});
const errors = Object.fromEntries(
  [
    ['400', 'Некорректный JSON'],
    ['401', 'Требуется авторизация'],
    ['403', 'Недостаточно прав'],
    ['404', 'Объект не найден'],
    ['409', 'Конфликт состояния'],
    ['413', 'Слишком большой запрос'],
    ['422', 'Ошибка валидации'],
    ['500', 'Внутренняя ошибка'],
  ].map(([code, description]) => [code!, response(description!, ref('Error'))]),
);

/** Собирает описание HTTP-операции со схемами, авторизацией и статусами, включая повтор оформления. */
function op(
  tag: string,
  summary: string,
  schema?: Schema,
  options: {
    public?: boolean;
    status?: number;
    input?: Schema;
    parameters?: Parameter[];
    description?: string;
    replay?: boolean;
  } = {},
): Operation {
  return {
    tags: [tag],
    summary,
    security: options.public ? [] : [{ bearerAuth: [] }],
    ...(options.description ? { description: options.description } : {}),
    ...(options.input ? { requestBody: body(options.input) } : {}),
    ...(options.parameters ? { parameters: options.parameters } : {}),
    responses: {
      ...errors,
      [options.status ?? 200]: response('Успешно', schema),
      ...(options.replay ? { '200': response('Ранее созданный заказ', schema) } : {}),
    },
  };
}

/**
 * Спецификация OpenAPI 3.0.3 для /openapi.json и Swagger UI.
 * Структуры данных генерируются из Zod; методы, пути и бизнес-описания операций заданы явно.
 */
export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Marketplace API',
    version: '1.0.0',
  },
  servers: [{ url: '/' }],
  tags: [
    'Auth',
    'Categories',
    'Seller',
    'Moderation',
    'Catalog',
    'Cart',
    'Orders',
    'Admin',
    'System',
  ].map((name) => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas,
  },
  paths: {
    '/health': {
      get: op(
        'System',
        'Проверка процесса',
        generateSchema(z.strictObject({ status: z.literal('ok') }), 'output'),
        {
          public: true,
        },
      ),
    },
    '/ready': {
      get: {
        ...op(
          'System',
          'Проверка подключения к PostgreSQL',
          generateSchema(z.strictObject({ status: z.literal('ready') }), 'output'),
          { public: true },
        ),
        responses: {
          '200': response(
            'Готов',
            generateSchema(z.strictObject({ status: z.literal('ready') }), 'output'),
          ),
          '503': response('БД недоступна', ref('Error')),
        },
      },
    },
    '/api/v1/auth/register': {
      post: op('Auth', 'Регистрация покупателя или продавца', ref('Tokens'), {
        public: true,
        status: 201,
        input: ref('Register'),
      }),
    },
    '/api/v1/auth/login': {
      post: op('Auth', 'Вход', ref('Tokens'), { public: true, input: ref('Login') }),
    },
    '/api/v1/auth/refresh': {
      post: op('Auth', 'Ротация refresh-токена', ref('Tokens'), {
        public: true,
        input: ref('Refresh'),
      }),
    },
    '/api/v1/auth/logout': {
      post: op('Auth', 'Отзыв refresh-токена', undefined, {
        public: true,
        status: 204,
        input: ref('Refresh'),
        description:
          'Access JWT остаётся действительным до истечения 15 минут. Повторный logout безопасен.',
      }),
    },
    '/api/v1/users/me': {
      get: op('Auth', 'Мой профиль', ref('User')),
      patch: op('Auth', 'Изменить имя', ref('User'), {
        input: generateSchema(updateProfileSchema, 'input'),
      }),
    },
    '/api/v1/categories': {
      get: op('Categories', 'Список категорий', list('Category'), {
        public: true,
        parameters: queryParameters(paginationSchema),
      }),
      post: op('Categories', 'Создать категорию — ADMIN', ref('Category'), {
        status: 201,
        input: ref('CategoryInput'),
      }),
    },
    '/api/v1/categories/{id}': {
      patch: op('Categories', 'Изменить категорию — ADMIN', ref('Category'), {
        parameters: [pathId()],
        input: ref('CategoryInput'),
      }),
      delete: op('Categories', 'Удалить пустую категорию — ADMIN', undefined, {
        status: 204,
        parameters: [pathId()],
      }),
    },
    '/api/v1/seller/products': {
      get: op('Seller', 'Список своих товаров — SELLER', list('Product'), {
        parameters: queryParameters(sellerProductQuerySchema),
      }),
      post: op('Seller', 'Создать черновик товара — SELLER', ref('Product'), {
        status: 201,
        input: ref('ProductInput'),
      }),
    },
    '/api/v1/seller/products/{id}': {
      get: op('Seller', 'Получить свой товар', ref('Product'), { parameters: [pathId()] }),
      patch: op('Seller', 'Изменить товар и вернуть в DRAFT', ref('Product'), {
        parameters: [pathId()],
        input: ref('ProductPatch'),
        description: 'В статусе PENDING изменения запрещены.',
      }),
      delete: op('Seller', 'Мягко удалить товар', undefined, {
        status: 204,
        parameters: [pathId()],
        description: 'Запрещено при модерации или активном резерве.',
      }),
    },
    '/api/v1/seller/products/{id}/submit': {
      post: op('Seller', 'Отправить товар на модерацию', ref('Ticket'), {
        status: 201,
        parameters: [pathId()],
        description:
          'Только DRAFT или REJECTED, требуется минимум один SKU. Сохраняется снимок товара.',
      }),
    },
    '/api/v1/seller/products/{id}/skus': {
      get: op(
        'Seller',
        'Список SKU своего товара',
        generateSchema(z.array(skuResponseSchema), 'output'),
        { parameters: [pathId()] },
      ),
      post: op('Seller', 'Создать SKU и вернуть товар в DRAFT', ref('Sku'), {
        status: 201,
        parameters: [pathId()],
        input: ref('SkuInput'),
      }),
    },
    '/api/v1/seller/products/{id}/skus/{skuId}': {
      patch: op('Seller', 'Изменить SKU', ref('Sku'), {
        parameters: [pathId(), pathId('skuId')],
        input: ref('SkuPatch'),
        description:
          'quantity — физический остаток, включая резерв. Ниже резерва уменьшать нельзя. Изменение имени или attributes возвращает товар в DRAFT; price, costPrice и quantity не требуют модерации. PENDING запрещает все изменения.',
      }),
      delete: op('Seller', 'Мягко удалить SKU и вернуть товар в DRAFT', undefined, {
        status: 204,
        parameters: [pathId(), pathId('skuId')],
        description: 'Запрещено при модерации или активном резерве.',
      }),
    },
    '/api/v1/moderation/tickets': {
      get: op('Moderation', 'Очередь и история — MODERATOR / ADMIN', list('Ticket'), {
        parameters: queryParameters(ticketQuerySchema),
      }),
    },
    '/api/v1/moderation/tickets/{id}': {
      get: op('Moderation', 'Заявка со снимком товара', ref('Ticket'), { parameters: [pathId()] }),
    },
    '/api/v1/moderation/tickets/{id}/approve': {
      post: op('Moderation', 'Одобрить товар', ref('Ticket'), {
        parameters: [pathId()],
        description: 'Повторное или конкурирующее решение возвращает 409.',
      }),
    },
    '/api/v1/moderation/tickets/{id}/reject': {
      post: op('Moderation', 'Отклонить товар с причиной', ref('Ticket'), {
        parameters: [pathId()],
        input: generateSchema(rejectSchema, 'input'),
      }),
    },
    '/api/v1/catalog/products': {
      get: op('Catalog', 'Публичный каталог', list('PublicProduct'), {
        public: true,
        parameters: queryParameters(catalogQuerySchema),
        description:
          'Только APPROVED, без архивных товаров/SKU. Фильтр цены: хотя бы один активный SKU в диапазоне; сортировка цены — по минимальной цене всех активных SKU. Нет в наличии — товар остаётся видимым.',
      }),
    },
    '/api/v1/catalog/products/{id}': {
      get: op('Catalog', 'Публичная карточка товара', ref('PublicProduct'), {
        public: true,
        parameters: [pathId()],
      }),
    },
    '/api/v1/cart': {
      get: op('Cart', 'Корзина с актуальными ценами — BUYER', ref('Cart')),
      delete: op('Cart', 'Очистить корзину', undefined, { status: 204 }),
    },
    '/api/v1/cart/items': {
      post: op('Cart', 'Добавить количество SKU в корзину', ref('CartChange'), {
        status: 201,
        input: generateSchema(addCartItemSchema, 'input'),
        description:
          'Количество прибавляется к существующему. Максимум 100 SKU и 10000 единиц одного SKU. Корзина не резервирует остатки.',
      }),
    },
    '/api/v1/cart/items/{skuId}': {
      patch: op('Cart', 'Установить количество SKU в корзине', ref('CartChange'), {
        parameters: [pathId('skuId')],
        input: generateSchema(updateCartItemSchema, 'input'),
      }),
      delete: op('Cart', 'Удалить SKU из корзины', undefined, {
        status: 204,
        parameters: [pathId('skuId')],
      }),
    },
    '/api/v1/orders': {
      post: op('Orders', 'Оформить всю корзину — BUYER', ref('Order'), {
        status: 201,
        replay: true,
        input: ref('Checkout'),
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: generateSchema(idempotencyKeySchema, 'input'),
          },
        ],
        description:
          'Атомарно резервирует остатки и очищает корзину. Повтор ключа для того же покупателя и адреса возвращает исходный заказ; другой адрес — 409. Ключ сохраняется на срок жизни заказа. Сумма не более 2147483647 копеек. Цены фиксируются при оформлении.',
      }),
      get: op('Orders', 'История своих заказов', list('Order'), {
        parameters: queryParameters(orderQuerySchema),
      }),
    },
    '/api/v1/orders/{id}': {
      get: op('Orders', 'Свой заказ', ref('Order'), { parameters: [pathId()] }),
    },
    '/api/v1/orders/{id}/cancel': {
      post: op('Orders', 'Отменить заказ и освободить резерв', ref('Order'), {
        parameters: [pathId()],
        description:
          'Только CREATED / PROCESSING. Повторная отмена возвращает тот же заказ без изменения остатков.',
      }),
    },
    '/api/v1/admin/orders': {
      get: op('Admin', 'Список всех заказов — ADMIN', list('Order'), {
        parameters: queryParameters(orderQuerySchema),
      }),
    },
    '/api/v1/admin/orders/{id}/status': {
      patch: op('Admin', 'Обработать или завершить заказ — ADMIN', ref('Order'), {
        parameters: [pathId()],
        input: generateSchema(orderStatusSchema, 'input'),
        description:
          'CREATED → PROCESSING → COMPLETED. Завершение списывает физический остаток и резерв. Повтор текущего статуса безопасен.',
      }),
    },
  } satisfies Record<string, Record<string, Operation>>,
};
