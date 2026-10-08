import type { CartEntry } from '../../domain/models';
import { availableQuantity, isPurchasable } from '../../domain/product-rules';

/**
 * Строит корзину с актуальными ценами, суммой в копейках и признаками доступности.
 * Недоступные позиции сохраняются; исходные данные и склад не меняются.
 */
export function toCartView(entries: CartEntry[]) {
  const items = entries.map((entry) => ({
    skuId: entry.skuId,
    productId: entry.sku.productId,
    productName: entry.sku.product.name,
    skuName: entry.sku.name,
    quantity: entry.quantity,
    unitPrice: entry.sku.price,
    subtotal: entry.quantity * entry.sku.price,
    availableQuantity: availableQuantity(entry.sku.inventory),
    available: isPurchasable(entry.sku) && availableQuantity(entry.sku.inventory) >= entry.quantity,
  }));
  return { items, total: items.reduce((sum, item) => sum + item.subtotal, 0), currency: 'RUB' };
}
