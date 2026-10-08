import { notFound } from '../../domain/errors';
import type { ProductDetails, Sku } from '../../domain/models';
import type { Repositories } from '../contracts/repositories';

/** Возвращает неархивный товар продавца; чужой товар не раскрывается и считается отсутствующим. */
export async function requireOwnedProduct(
  repositories: Repositories,
  productId: string,
  sellerId: string,
): Promise<ProductDetails> {
  const product = await repositories.products.findOwned(productId, sellerId);
  if (!product) {
    throw notFound('PRODUCT_NOT_FOUND', 'Товар не найден');
  }
  return product;
}

/** Требует существующую категорию перед записью товара или изменением категории. */
export async function requireCategory(
  repositories: Repositories,
  categoryId: string,
): Promise<void> {
  if (!(await repositories.categories.findById(categoryId))) {
    throw notFound('CATEGORY_NOT_FOUND', 'Категория не найдена');
  }
}

/** Находит SKU среди загруженных вариантов товара; чужой или отсутствующий SKU недоступен. */
export function requireProductSku(product: ProductDetails, skuId: string): Sku {
  const sku = product.skus.find((item) => item.id === skuId);
  if (!sku) {
    throw notFound('SKU_NOT_FOUND', 'SKU не найден');
  }
  return sku;
}
