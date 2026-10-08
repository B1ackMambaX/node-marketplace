import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);
/** Проверяет публичную регистрацию, нормализует email и допускает только BUYER или SELLER. */
export const registerSchema = z
  .object({
    email,
    password: z.string().min(12).max(128),
    name: z.string().trim().min(1).max(100),
    role: z.enum(['BUYER', 'SELLER']).default('BUYER'),
  })
  .strict();
/** Проверяет тело входа и нормализует email перед поиском пользователя. */
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
/** Проверяет тело ротации или отзыва refresh-токена, запрещая дополнительные поля. */
export const refreshSchema = z.object({ refreshToken: z.string().min(32).max(512) }).strict();
/** Проверяет новое непустое имя собственного профиля. */
export const updateProfileSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
