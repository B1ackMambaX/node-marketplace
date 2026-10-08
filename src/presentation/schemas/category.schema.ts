import { z } from 'zod';

/** Проверяет непустое имя категории и запрещает дополнительные поля. */
export const categorySchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
