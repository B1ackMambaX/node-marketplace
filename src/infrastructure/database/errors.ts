import { Prisma } from '../../generated/prisma/client';
import { conflict, notFound } from '../../domain/errors';

/** Преобразует известные конфликты Prisma в ошибки приложения; неизвестные ошибки возвращает без изменений. */
export function translateDatabaseError(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return error;
  }
  switch (error.code) {
    case 'P2002':
      return conflict('CONFLICT', 'Запись с такими данными уже существует');
    case 'P2003':
      return conflict('REFERENCE_CONFLICT', 'Объект связан с другими записями или не существует');
    case 'P2025':
      return notFound('NOT_FOUND', 'Объект не найден');
    case 'P2034':
      return conflict('CONCURRENT_MODIFICATION', 'Данные изменились; повторите запрос');
    default:
      return error;
  }
}
