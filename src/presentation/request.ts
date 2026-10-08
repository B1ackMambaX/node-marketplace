import type { Request } from 'express';
import { z } from 'zod';
import { unauthorized } from '../domain/errors';
import type { UserProfile } from '../domain/models';

/** Читает именованный параметр пути и требует корректный UUID. */
export function pathId(request: Request, name = 'id'): string {
  return z.uuid().parse(request.params[name]);
}

/** Возвращает профиль из контекста аутентификации; без него выбрасывает ошибку авторизации. */
export function currentUser(request: Request): UserProfile {
  if (!request.user) {
    throw unauthorized('UNAUTHORIZED', 'Требуется авторизация');
  }
  return request.user;
}
