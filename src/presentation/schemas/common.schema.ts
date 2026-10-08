import { z } from 'zod';

/** Преобразует query-параметры в числа; по умолчанию limit 20 и offset 0. */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
