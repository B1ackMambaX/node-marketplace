import { z } from 'zod';
import { paginationSchema } from './common.schema';

/** Проверяет и обрезает пробелы адреса оформления, запрещая дополнительные поля. */
export const checkoutSchema = z
  .object({ deliveryAddress: z.string().trim().min(5).max(1000) })
  .strict();
/** Проверяет формат заголовка Idempotency-Key; принадлежность ключа покупателю обеспечивает сервис. */
export const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_.:-]+$/);
/** Проверяет пагинацию и необязательный фильтр статуса заказов. */
export const orderQuerySchema = paginationSchema.extend({
  status: z.enum(['CREATED', 'PROCESSING', 'COMPLETED', 'CANCELLED']).optional(),
});
/** Допускает только PROCESSING или COMPLETED в запросе администратора; переход проверяет сервис. */
export const orderStatusSchema = z.object({ status: z.enum(['PROCESSING', 'COMPLETED']) }).strict();
