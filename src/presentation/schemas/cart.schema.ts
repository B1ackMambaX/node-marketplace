import { z } from 'zod';
import { MAX_QUANTITY } from '../../domain/constants';

const quantity = z.number().int().min(1).max(MAX_QUANTITY);
/** Проверяет UUID SKU и положительное количество, прибавляемое к корзине. */
export const addCartItemSchema = z.object({ skuId: z.uuid(), quantity }).strict();
/** Проверяет положительное количество для замены количества существующей позиции. */
export const updateCartItemSchema = z.object({ quantity }).strict();
