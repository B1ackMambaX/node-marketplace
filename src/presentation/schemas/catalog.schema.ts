import { z } from 'zod';
import { MAX_INT } from '../../domain/constants';
import { paginationSchema } from './common.schema';

/** Нормализует фильтры, цены и пагинацию каталога; требует minPrice ≤ maxPrice. */
export const catalogQuerySchema = paginationSchema
  .extend({
    search: z.string().trim().max(200).optional(),
    categoryId: z.uuid().optional(),
    minPrice: z.coerce.number().int().min(0).max(MAX_INT).optional(),
    maxPrice: z.coerce.number().int().min(0).max(MAX_INT).optional(),
    sort: z.enum(['newest', 'oldest', 'priceAsc', 'priceDesc']).default('newest'),
  })
  .refine(
    (q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice,
    'minPrice должен быть не больше maxPrice',
  )
  .describe('minPrice должен быть не больше maxPrice.');
