import { z } from 'zod';
import { paginationSchema } from './common.schema';
import { MAX_INT, MAX_QUANTITY } from '../../domain/constants';

/** Схема положительного количества покупаемых единиц с лимитом MAX_QUANTITY. */
export const quantity = z.number().int().min(1).max(MAX_QUANTITY);
/** Схема физического остатка: целое число от 0 до MAX_INT. */
export const stock = z.number().int().min(0).max(MAX_INT);
/** Схема положительной цены продажи в целых копейках. */
export const money = z.number().int().min(1).max(MAX_INT);
/** Проверяет строковые характеристики SKU с ограничением числа и длины ключей и значений. */
export const attributes = z
  .record(z.string().min(1).max(100), z.string().max(200))
  .refine((value) => Object.keys(value).length <= 50, 'Не более 50 характеристик')
  .meta({ maxProperties: 50 });
const images = z
  .array(
    z
      .url()
      .refine((url) => /^https?:\/\//i.test(url), 'Требуется HTTP(S) URL')
      .meta({ pattern: '^https?://', description: 'HTTP(S) URL; регистр схемы не учитывается.' }),
  )
  .max(10);
const productFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10_000),
  categoryId: z.uuid(),
  images,
};
/** Проверяет контент нового товара; пропущенный список изображений становится пустым. */
export const productCreate = z.object({ ...productFields, images: images.default([]) }).strict();
// No defaults in PATCH schemas: omitted fields must never reset existing data.
/** Проверяет непустой PATCH товара без defaults, сохраняя смысл пропущенных полей. */
export const productPatch = z
  .object(productFields)
  .strict()
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Пустое изменение')
  .meta({ minProperties: 1 });
const skuFields = {
  name: z.string().trim().min(1).max(200),
  attributes,
  price: money,
  costPrice: z.number().int().min(0).max(MAX_INT).nullable().optional(),
  quantity: stock,
};
/** Проверяет новый SKU; пропущенные характеристики и физический остаток получают defaults. */
export const skuCreate = z
  .object({ ...skuFields, attributes: attributes.default({}), quantity: stock.default(0) })
  .strict();
/** Проверяет непустой PATCH SKU без defaults; допустимость остатка относительно резерва проверяет сервис. */
export const skuPatch = z
  .object(skuFields)
  .strict()
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Пустое изменение')
  .meta({ minProperties: 1 });

/** Проверяет пагинацию и необязательный статус в списке товаров продавца. */
export const sellerProductQuerySchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
});
