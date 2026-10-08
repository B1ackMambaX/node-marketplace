import type { UserProfile } from '../../domain/models';

/** Контракт хеширования и проверки паролей без привязки сервиса к криптобиблиотеке. */
export interface PasswordHasher {
  /** Создаёт хеш пароля для хранения вместо исходного значения. */
  hash(password: string): Promise<string>;
  /** Сравнивает исходный пароль с сохранённым хешем. */
  verify(password: string, hash: string): Promise<boolean>;
}

/** Контракт детерминированного хеширования токенов и нормализованных данных запроса. */
export interface ValueHasher {
  /** Возвращает одинаковый хеш для одинаковой строки. */
  hash(value: string): string;
}

/** Контракт выпуска access/refresh-токенов и проверки access-токена. */
export interface TokenProvider extends ValueHasher {
  /** Выпускает access-токен для указанного пользователя. */
  createAccess(user: UserProfile): Promise<string>;
  /** Проверяет токен и возвращает ID пользователя; актуальная роль читается отдельно. */
  verifyAccess(token: string): Promise<string>;
  /** Создаёт новый случайный refresh-токен, хеш которого сохраняется в сессии. */
  createRefresh(): string;
}

/** Источник текущего времени; в тестах позволяет управлять сроком действия сессий. */
export interface Clock {
  /** Возвращает текущий момент для прикладного сценария. */
  now(): Date;
}
