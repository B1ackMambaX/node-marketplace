import { z } from 'zod';
import { MAX_INT, MAX_QUANTITY } from '../../domain/constants';

const id = z.uuid();
const date = z.iso.datetime();
const integer = z.number().int().min(0).max(MAX_INT);
const price = integer.min(1);
const quantity = z.number().int().min(1).max(MAX_QUANTITY);
const attributes = z.record(z.string(), z.string());

// These schemas describe serialized HTTP responses, including ISO dates.
/** Документирует единый JSON-ответ ошибки с необязательными details. */
export const errorResponseSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
/** Документирует сериализованный профиль без хеша пароля. */
export const userResponseSchema = z.strictObject({
  id,
  email: z.email(),
  name: z.string(),
  role: z.enum(['BUYER', 'SELLER', 'MODERATOR', 'ADMIN']),
  createdAt: date.optional(),
});
/** Документирует пару токенов с безопасным профилем и expiresIn в секундах. */
export const tokensResponseSchema = z.strictObject({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: integer.min(1),
  user: userResponseSchema,
});
/** Документирует категорию с датами в виде ISO-строк. */
export const categoryResponseSchema = z.strictObject({
  id,
  name: z.string(),
  createdAt: date,
  updatedAt: date,
});
/** Документирует остаток и резерв в кабинете продавца; не используется в публичном каталоге. */
export const inventoryResponseSchema = z.strictObject({
  skuId: id,
  quantity: integer,
  reserved: integer,
});
/** Документирует SKU продавца, включая себестоимость и внутренний склад. */
export const skuResponseSchema = z.strictObject({
  id,
  productId: id,
  name: z.string(),
  attributes,
  price,
  costPrice: integer.nullable(),
  deletedAt: date.nullable(),
  createdAt: date,
  updatedAt: date,
  inventory: inventoryResponseSchema.nullable(),
});
/** Документирует товар кабинета продавца с категорией и SKU. */
export const productResponseSchema = z.strictObject({
  id,
  sellerId: id,
  categoryId: id,
  name: z.string(),
  description: z.string(),
  images: z.array(z.string()),
  status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']),
  deletedAt: date.nullable(),
  createdAt: date,
  updatedAt: date,
  category: categoryResponseSchema,
  skus: z.array(skuResponseSchema),
});
/** Документирует публичный SKU с ценой и доступным остатком без себестоимости и резерва. */
export const publicSkuResponseSchema = z.strictObject({
  id,
  name: z.string(),
  attributes,
  price,
  availableQuantity: integer,
});
/** Документирует публичную карточку с безопасными полями продавца и SKU. */
export const publicProductResponseSchema = z.strictObject({
  id,
  name: z.string(),
  description: z.string(),
  images: z.array(z.string()),
  category: z.strictObject({ id, name: z.string() }),
  seller: z.strictObject({ id, name: z.string() }),
  createdAt: date,
  skus: z.array(publicSkuResponseSchema),
});
/** Документирует заявку со снимком товара и сведениями о решении. */
export const ticketResponseSchema = z.strictObject({
  id,
  productId: id,
  moderatorId: id.nullable(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  snapshot: z.record(z.string(), z.unknown()),
  reason: z.string().nullable(),
  createdAt: date,
  decidedAt: date.nullable(),
});
/** Документирует позицию корзины с актуальной ценой, суммой и доступностью. */
export const cartItemResponseSchema = z.strictObject({
  skuId: id,
  productId: id,
  productName: z.string(),
  skuName: z.string(),
  quantity,
  unitPrice: price,
  subtotal: z.number().int().min(1),
  availableQuantity: integer,
  available: z.boolean(),
});
/** Документирует корзину с итогом в копейках и валютой RUB. */
export const cartResponseSchema = z.strictObject({
  items: z.array(cartItemResponseSchema),
  total: z.number().int().min(0),
  currency: z.literal('RUB'),
});
/** Документирует сохранённое количество SKU после изменения корзины. */
export const cartChangeResponseSchema = z.strictObject({ skuId: id, quantity });
/** Документирует снимок позиции заказа с зафиксированной ценой. */
export const orderItemResponseSchema = z.strictObject({
  skuId: id,
  productName: z.string(),
  skuName: z.string(),
  unitPrice: price,
  quantity,
});
/** Документирует заказ без ключа идемпотентности и хеша запроса. */
export const orderResponseSchema = z.strictObject({
  id,
  buyerId: id,
  status: z.enum(['CREATED', 'PROCESSING', 'COMPLETED', 'CANCELLED']),
  total: price,
  deliveryAddress: z.string(),
  createdAt: date,
  updatedAt: date,
  items: z.array(orderItemResponseSchema),
});

/**
 * Создаёт схему сериализованной страницы заданных элементов для OpenAPI.
 * Схемы ответов описывают документацию и не добавляют runtime-проверку HTTP-ответов.
 */
export function pageResponseSchema<T extends z.ZodType>(item: T) {
  return z.strictObject({
    items: z.array(item),
    total: integer,
    limit: integer.min(1).max(100),
    offset: integer,
  });
}
