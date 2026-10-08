import { z } from 'zod';
import { paginationSchema } from './common.schema';

/** Проверяет фильтры заявок и пагинацию; статус по умолчанию PENDING. */
export const ticketQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
  productId: z.uuid().optional(),
});
/** Допускает только пустой объект для решения об одобрении. */
export const approveSchema = z.object({}).strict();
/** Проверяет непустую причину отклонения заявки. */
export const rejectSchema = z.object({ reason: z.string().trim().min(1).max(2000) }).strict();
