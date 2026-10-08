import { conflict } from '../../domain/errors';
import { ensureProductEditable } from '../../domain/product-rules';
import type { CreateProductInput, SellerProductQuery, UpdateProductInput } from '../dto';
import type { RepositoryContext } from '../contracts/unit-of-work';
import { requireCategory, requireOwnedProduct } from './access';

/** Управление товарами продавца с проверками владельца, модерации и активных резервов. */
export class ProductService {
  constructor(private readonly unitOfWork: RepositoryContext) {}

  /** Возвращает страницу неархивных товаров конкретного продавца. */
  list(sellerId: string, query: SellerProductQuery) {
    return this.unitOfWork.read((repositories) => repositories.products.listOwned(sellerId, query));
  }

  /** Возвращает свой товар; чужой и архивный обрабатываются как отсутствующие. */
  get(sellerId: string, productId: string) {
    return this.unitOfWork.read((repositories) =>
      requireOwnedProduct(repositories, productId, sellerId),
    );
  }

  /** Проверяет категорию и создаёт черновик товара указанного продавца. */
  create(sellerId: string, input: CreateProductInput) {
    return this.unitOfWork.transaction(async (repositories) => {
      await requireCategory(repositories, input.categoryId);
      return repositories.products.create(sellerId, input);
    });
  }

  /** Проверяет владельца и запрет PENDING, обновляет контент и возвращает товар в DRAFT. */
  update(sellerId: string, productId: string, input: UpdateProductInput) {
    return this.unitOfWork.transaction(async (repositories) => {
      ensureProductEditable(await requireOwnedProduct(repositories, productId, sellerId));
      if (input.categoryId) {
        await requireCategory(repositories, input.categoryId);
      }
      await repositories.products.setStatus(productId, 'DRAFT');
      return repositories.products.updateContent(productId, input);
    });
  }

  /** Мягко удаляет свой товар, если он не на модерации и его SKU не имеют резервов. */
  delete(sellerId: string, productId: string): Promise<void> {
    return this.unitOfWork.transaction(async (repositories) => {
      const product = await requireOwnedProduct(repositories, productId, sellerId);
      ensureProductEditable(product);
      if (product.skus.some((sku) => (sku.inventory?.reserved ?? 0) > 0)) {
        throw conflict('ACTIVE_RESERVATIONS', 'У товара есть активные резервы');
      }
      await repositories.products.softDelete(productId);
    });
  }

  /** Отправляет DRAFT или REJECTED с активным SKU на проверку; статус и снимок сохраняются атомарно. */
  submit(sellerId: string, productId: string) {
    return this.unitOfWork.transaction(async (repositories) => {
      const product = await requireOwnedProduct(repositories, productId, sellerId);
      if (product.status !== 'DRAFT' && product.status !== 'REJECTED') {
        throw conflict(
          'INVALID_PRODUCT_STATUS',
          'Товар нельзя отправить на проверку в текущем статусе',
        );
      }
      if (product.skus.length === 0) {
        throw conflict('SKU_REQUIRED', 'Добавьте хотя бы один SKU');
      }
      await repositories.products.setStatus(productId, 'PENDING');
      return repositories.tickets.create(product);
    });
  }
}
