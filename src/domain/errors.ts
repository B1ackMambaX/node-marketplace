/** Категория ошибки сценария; соответствующий HTTP-статус выбирает HTTP-слой. */
export type ErrorKind = 'unauthorized' | 'forbidden' | 'notFound' | 'conflict' | 'validation';

/**
 * Ошибка бизнес-правила или прикладного сценария с категорией и стабильным кодом.
 * Не содержит HTTP-статус и не зависит от способа доставки ответа.
 */
export class ApplicationError extends Error {
  constructor(
    public readonly kind: ErrorKind,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

/** Создаёт ошибку отсутствующего или недоступного текущему пользователю объекта. */
export const notFound = (code: string, message: string) =>
  new ApplicationError('notFound', code, message);
/** Создаёт ошибку операции, несовместимой с текущим состоянием данных. */
export const conflict = (code: string, message: string) =>
  new ApplicationError('conflict', code, message);
/** Создаёт ошибку отсутствующих, неверных или истёкших учётных данных. */
export const unauthorized = (code: string, message: string) =>
  new ApplicationError('unauthorized', code, message);
/** Создаёт ошибку входных значений, нарушающих правило сценария. */
export const invalidInput = (code: string, message: string) =>
  new ApplicationError('validation', code, message);
