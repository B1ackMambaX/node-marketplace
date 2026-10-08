import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApplicationError, type ErrorKind } from '../../domain/errors';

const statusByKind: Record<ErrorKind, number> = {
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  validation: 422,
};

/**
 * Переводит ошибки валидации, сценариев и JSON-парсинга в единый HTTP-ответ.
 * Неизвестные ошибки журналирует и скрывает за INTERNAL_ERROR без внутренних подробностей.
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ZodError) {
    response
      .status(422)
      .json({ code: 'VALIDATION_ERROR', message: 'Некорректные данные', details: error.issues });
    return;
  }
  if (error instanceof ApplicationError) {
    response.status(statusByKind[error.kind]).json({ code: error.code, message: error.message });
    return;
  }
  const status =
    typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
  if (error instanceof SyntaxError && status === 400) {
    response.status(400).json({ code: 'INVALID_JSON', message: 'Некорректный JSON' });
    return;
  }
  if (status === 413) {
    response.status(413).json({ code: 'BODY_TOO_LARGE', message: 'Слишком большой запрос' });
    return;
  }
  console.error(error);
  response.status(500).json({ code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' });
};
