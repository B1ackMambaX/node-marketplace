import type { Inventory, Product, PurchasableSku } from './models';
import { conflict } from './errors';

/**
 * Запрещает изменение товара, пока он находится на модерации.
 * @throws ApplicationError Если статус товара PENDING.
 */
export function ensureProductEditable(product: Product): void {
  if (product.status === 'PENDING') {
    throw conflict('PRODUCT_IN_REVIEW', 'Товар находится на модерации');
  }
}

/** Возвращает физический остаток за вычетом резерва; без складской записи возвращает 0. */
export function availableQuantity(inventory: Inventory | null): number {
  return inventory ? inventory.quantity - inventory.reserved : 0;
}

/**
 * Проверяет публикацию товара и отсутствие мягкого удаления товара и SKU.
 * Количество на складе проверяется отдельно.
 */
export function isPurchasable(sku: PurchasableSku): boolean {
  return !sku.deletedAt && !sku.product.deletedAt && sku.product.status === 'APPROVED';
}

/**
 * Требует существующий SKU опубликованного, неархивного товара.
 * @throws ApplicationError Если SKU недоступен для покупки.
 */
export function ensurePurchasable(sku: PurchasableSku | null): asserts sku is PurchasableSku {
  if (!sku || !isPurchasable(sku)) {
    throw conflict('SKU_UNAVAILABLE', 'SKU недоступен для покупки');
  }
}

/**
 * Требует достаточный свободный остаток для указанного количества.
 * Не создаёт резерв; запись резерва выполняется отдельно.
 */
export function ensureStockAvailable(sku: PurchasableSku, quantity: number): void {
  if (availableQuantity(sku.inventory) < quantity) {
    throw conflict('INSUFFICIENT_STOCK', 'Недостаточно товара');
  }
}
