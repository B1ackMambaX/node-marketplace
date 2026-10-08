/** Верхняя граница PostgreSQL INTEGER для цен, остатков и суммы заказа. */
export const MAX_INT = 2_147_483_647;
/** Максимальное число разных SKU в корзине одного покупателя. */
export const MAX_CART_ITEMS = 100;
/** Максимальное количество единиц одного SKU в корзине или позиции заказа. */
export const MAX_QUANTITY = 10_000;
/** Срок действия access-токена в секундах: 15 минут. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** Срок действия refresh-сессии в миллисекундах: 7 дней. */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
