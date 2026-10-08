import type { CatalogProduct } from '../../domain/models';
import { availableQuantity } from '../../domain/product-rules';

/** Строит публичную карточку с доступным остатком, исключая себестоимость и внутренний резерв. */
export function toPublicProduct(product: CatalogProduct) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    images: product.images,
    category: { id: product.category.id, name: product.category.name },
    seller: product.seller,
    createdAt: product.createdAt,
    skus: product.skus.map((sku) => ({
      id: sku.id,
      name: sku.name,
      attributes: sku.attributes,
      price: sku.price,
      availableQuantity: availableQuantity(sku.inventory),
    })),
  };
}
