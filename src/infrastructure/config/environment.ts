/** Читает обязательный DATABASE_URL; при отсутствии завершает настройку понятной ошибкой. */
export function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required');
  return value;
}

/** Проверяет минимум 32 символа JWT_SECRET и возвращает его байты для подписи JWT. */
export function jwtSecret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32)
    throw new Error('JWT_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(value);
}
